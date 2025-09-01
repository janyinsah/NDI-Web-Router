#include "ndi_manager.h"
#include <iostream>
#include <thread>
#include <chrono>
#include <random>
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <set>
#include <cctype>
#include <cstdlib>
#include <cstring>

NDIManager::NDIManager() : ndi_find_(nullptr), should_stop_routing_(false), is_updating_routes_(false), preview_receiver_(nullptr) {}

NDIManager::~NDIManager() {
    Shutdown();
}

bool NDIManager::Initialize() {
    if (!NDIlib_initialize()) {
        std::cerr << "Failed to initialize NDI library" << std::endl;
        return false;
    }

    NDIlib_find_create_t find_desc;
    find_desc.show_local_sources = true;
    find_desc.p_groups = nullptr;
    find_desc.p_extra_ips = nullptr;

    ndi_find_ = NDIlib_find_create_v2(&find_desc);
    if (!ndi_find_) {
        std::cerr << "Failed to create NDI finder" << std::endl;
        NDIlib_destroy();
        return false;
    }

    // Wait for NDI to fully initialize before creating senders
    std::this_thread::sleep_for(std::chrono::milliseconds(500));

    // Initialize default matrix layout
    InitializeDefaultMatrix();
    
    // Start routing thread
    should_stop_routing_ = false;
    routing_thread_ = std::make_unique<std::thread>(&NDIManager::ProcessRoutes, this);
    
    std::cout << "NDI Manager initialized successfully" << std::endl;
    return true;
}

void NDIManager::Shutdown() {
    // Stop routing thread
    should_stop_routing_ = true;
    if (routing_thread_ && routing_thread_->joinable()) {
        routing_thread_->join();
    }
    
    if (ndi_find_) {
        NDIlib_find_destroy(ndi_find_);
        ndi_find_ = nullptr;
    }

    for (auto& receiver : receivers_) {
        if (receiver) {
            NDIlib_recv_destroy(*receiver);
        }
    }
    receivers_.clear();

    for (auto& sender : senders_) {
        if (sender) {
            NDIlib_send_destroy(*sender);
        }
    }
    senders_.clear();

    // Clean up matrix destination senders
    for (auto& destination : matrix_destinations_) {
        if (destination.ndi_sender) {
            NDIlib_send_destroy(destination.ndi_sender);
        }
    }
    matrix_destinations_.clear();
    matrix_source_slots_.clear();

    // Clean up route receivers
    for (auto& pair : route_receivers_) {
        if (pair.second) {
            NDIlib_recv_destroy(pair.second);
        }
    }
    route_receivers_.clear();

    // Clean up preview receiver
    if (preview_receiver_) {
        NDIlib_recv_destroy(preview_receiver_);
        preview_receiver_ = nullptr;
    }

    matrix_routes_.clear();
    NDIlib_destroy();
    std::cout << "NDI Manager shut down" << std::endl;
}

std::vector<NDISource> NDIManager::DiscoverSources() {
    std::vector<NDISource> sources;
    
    if (!ndi_find_) {
        std::cout << "ERROR: NDI finder is null" << std::endl;
        return sources;
    }

    uint32_t num_sources = 0;
    const NDIlib_source_t* ndi_sources = NDIlib_find_get_current_sources(ndi_find_, &num_sources);
    
    if (!ndi_sources && num_sources > 0) {
        std::cout << "ERROR: NDI sources pointer is null but num_sources is " << num_sources << std::endl;
        return sources;
    }
    
    std::cout << "NDI finder returned " << num_sources << " sources" << std::endl;

    for (uint32_t i = 0; i < num_sources; i++) {
        std::string source_name = ndi_sources[i].p_ndi_name ? ndi_sources[i].p_ndi_name : "";
        
        // Filter out our own created destinations
        bool is_our_destination = false;
        for (const auto& destination : matrix_destinations_) {
            if (destination.name == source_name) {
                is_our_destination = true;
                break;
            }
        }
        
        // Only add if it's not one of our destinations
        if (!is_our_destination && !source_name.empty()) {
            NDISource source;
            source.name = source_name;
            source.url = ndi_sources[i].p_url_address ? ndi_sources[i].p_url_address : "";
            source.is_connected = true;
            source.group_name = "";
            sources.push_back(source);
        }
    }

    return sources;
}

std::vector<NDISource> NDIManager::DiscoverStudioMonitors() {
    std::vector<NDISource> studio_monitors;
    
    if (!ndi_find_) {
        return studio_monitors;
    }

    uint32_t num_sources = 0;
    const NDIlib_source_t* ndi_sources = NDIlib_find_get_current_sources(ndi_find_, &num_sources);

    for (uint32_t i = 0; i < num_sources; i++) {
        std::string source_name = ndi_sources[i].p_ndi_name ? ndi_sources[i].p_ndi_name : "";
        
        // Look for sources that contain "Studio Monitor" (case insensitive)
        std::string lower_name = source_name;
        std::transform(lower_name.begin(), lower_name.end(), lower_name.begin(), ::tolower);
        
        if (lower_name.find("studio monitor") != std::string::npos && !source_name.empty()) {
            NDISource source;
            source.name = source_name;
            source.url = ndi_sources[i].p_url_address ? ndi_sources[i].p_url_address : "";
            source.is_connected = true;
            source.group_name = "";
            studio_monitors.push_back(source);
        }
    }

    return studio_monitors;
}

std::vector<MatrixSourceSlot> NDIManager::GetSourceSlots() {
    return matrix_source_slots_;
}

bool NDIManager::AssignSourceToSlot(int slot_number, const std::string& ndi_source_name, const std::string& display_name) {
    // Find existing slot or create new one
    MatrixSourceSlot* slot = FindMatrixSourceSlot(slot_number);
    
    if (slot) {
        // Update existing slot
        slot->assigned_ndi_source = ndi_source_name;
        slot->display_name = display_name;
        slot->is_assigned = true;
    } else {
        // Create new slot
        MatrixSourceSlot new_slot;
        new_slot.slot_number = slot_number;
        new_slot.assigned_ndi_source = ndi_source_name;
        new_slot.display_name = display_name;
        new_slot.is_assigned = true;
        matrix_source_slots_.push_back(new_slot);
    }
    
    std::cout << "Assigned NDI source '" << ndi_source_name << "' to slot " << slot_number << std::endl;
    return true;
}

bool NDIManager::UnassignSourceSlot(int slot_number) {
    try {
        std::cout << "=== STARTING UNASSIGN FOR SOURCE SLOT " << slot_number << " ===" << std::endl;
        
        // Pause routing operations
        std::cout << "THREAD SAFETY: Setting update flag to pause routing thread" << std::endl;
        is_updating_routes_ = true;
        
        // Give the routing thread a moment to see the flag
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
        
        MatrixSourceSlot* slot = FindMatrixSourceSlot(slot_number);
        if (!slot) {
            std::cout << "ERROR: Source slot " << slot_number << " not found" << std::endl;
            is_updating_routes_ = false;
            return false;
        }
        
        if (!slot->is_assigned) {
            std::cout << "WARNING: Source slot " << slot_number << " is not assigned" << std::endl;
            is_updating_routes_ = false;
            return true; // Already unassigned
        }
        
        std::string source_name = slot->assigned_ndi_source;
        std::cout << "Unassigning slot " << slot_number << " (was: '" << source_name << "')" << std::endl;
        
        // Check if there are any routes using this source slot
        std::cout << "Checking for routes using source slot " << slot_number << "..." << std::endl;
        size_t routes_before = matrix_routes_.size();
        
        // Count routes that will be removed
        int routes_to_remove = 0;
        for (const auto& route : matrix_routes_) {
            if (route.source_slot == slot_number) {
                std::cout << "Found route: source " << route.source_slot << " -> dest " << route.destination_slot << " (active: " << route.is_active << ")" << std::endl;
                routes_to_remove++;
            }
        }
        
        std::cout << "Will remove " << routes_to_remove << " routes" << std::endl;
        
        // Remove all routes that use this source slot
        matrix_routes_.erase(
            std::remove_if(matrix_routes_.begin(), matrix_routes_.end(),
                [slot_number](const MatrixRoute& route) {
                    return route.source_slot == slot_number;
                }),
            matrix_routes_.end()
        );
        
        size_t routes_after = matrix_routes_.size();
        std::cout << "Removed " << (routes_before - routes_after) << " routes (before: " << routes_before << ", after: " << routes_after << ")" << std::endl;
        
        // Clear preview if it's using this source
        if (current_preview_source_ == source_name) {
            std::cout << "Clearing preview source (was using source being unassigned)" << std::endl;
            ClearPreviewSource();
        }
        
        // Clear current_source_slot for destinations that were using this source
        std::cout << "Clearing destination references..." << std::endl;
        for (auto& destination : matrix_destinations_) {
            if (destination.current_source_slot == slot_number) {
                std::cout << "Clearing destination " << destination.slot_number << " current source" << std::endl;
                destination.current_source_slot = 0;
            }
        }
        
        // Clear the slot data BEFORE cleanup
        std::cout << "Clearing source slot data..." << std::endl;
        slot->assigned_ndi_source.clear();
        slot->display_name.clear();
        slot->is_assigned = false;
        
        std::cout << "Source slot data cleared. Current receiver count: " << route_receivers_.size() << std::endl;
        
        // Check if the source has a receiver
        auto receiver_it = route_receivers_.find(source_name);
        if (receiver_it != route_receivers_.end()) {
            std::cout << "Found receiver for source '" << source_name << "', will be cleaned up" << std::endl;
        } else {
            std::cout << "No receiver found for source '" << source_name << "'" << std::endl;
        }
        
        std::cout << "Starting receiver cleanup..." << std::endl;
        
        // Clean up unused receivers
        CleanupUnusedReceivers();
        
        std::cout << "THREAD SAFETY: Re-enabling routing thread" << std::endl;
        is_updating_routes_ = false;
        
        std::cout << "=== SLOT " << slot_number << " UNASSIGNED SUCCESSFULLY ===" << std::endl;
        return true;
    } catch (const std::exception& e) {
        std::cout << "=== ERROR in UnassignSourceSlot: " << e.what() << " ===" << std::endl;
        is_updating_routes_ = false;
        return false;
    } catch (...) {
        std::cout << "=== UNKNOWN ERROR in UnassignSourceSlot ===" << std::endl;
        is_updating_routes_ = false;
        return false;
    }
}

std::vector<MatrixDestination> NDIManager::GetMatrixDestinations() {
    return matrix_destinations_;
}

bool NDIManager::CreateMatrixDestination(const std::string& name, const std::string& description) {
    // Find the next available slot number
    int next_slot = 1;
    for (const auto& dest : matrix_destinations_) {
        if (dest.slot_number >= next_slot) {
            next_slot = dest.slot_number + 1;
        }
    }
    
    MatrixDestination destination;
    destination.slot_number = next_slot;
    destination.name = name;
    destination.description = description;
    destination.is_enabled = true;
    destination.current_source_slot = 0; // 0 means no source assigned

    // Create actual NDI sender for this destination with low-latency optimizations
    NDIlib_send_create_t send_desc;
    send_desc.p_ndi_name = destination.name.c_str();
    send_desc.p_groups = nullptr;
    send_desc.clock_video = false; // No clocking for lowest latency
    send_desc.clock_audio = false;

    std::cout << "Attempting to create NDI sender for: " << name << std::endl;
    destination.ndi_sender = NDIlib_send_create(&send_desc);
    
    if (!destination.ndi_sender) {
        std::cerr << "Failed to create NDI sender for destination: " << name << std::endl;
        std::cerr << "This may be due to NDI runtime issues or resource limitations" << std::endl;
        return false;
    }

    matrix_destinations_.push_back(destination);
    
    std::cout << "Created matrix destination '" << name << "' in slot " << next_slot << " (now visible on network)" << std::endl;
    return true;
}

bool NDIManager::RemoveMatrixDestination(int slot_number) {
    for (auto it = matrix_destinations_.begin(); it != matrix_destinations_.end(); ++it) {
        if (it->slot_number == slot_number) {
            // Remove any routes using this destination
            matrix_routes_.erase(
                std::remove_if(matrix_routes_.begin(), matrix_routes_.end(),
                    [slot_number](const MatrixRoute& route) {
                        return route.destination_slot == slot_number;
                    }),
                matrix_routes_.end()
            );
            
            // Destroy the NDI sender
            if (it->ndi_sender) {
                NDIlib_send_destroy(it->ndi_sender);
            }
            
            std::cout << "Removed matrix destination: " << it->name << " (slot " << slot_number << ", no longer visible on network)" << std::endl;
            matrix_destinations_.erase(it);
            return true;
        }
    }
    return false;
}


bool NDIManager::CreateMatrixRoute(int source_slot, int destination_slot) {
    // Find the source slot
    MatrixSourceSlot* src_slot = FindMatrixSourceSlot(source_slot);
    if (!src_slot || !src_slot->is_assigned) {
        std::cerr << "Source slot " << source_slot << " not found or not assigned" << std::endl;
        return false;
    }
    
    // Find the destination
    MatrixDestination* dest = FindMatrixDestination(destination_slot);
    if (!dest) {
        std::cerr << "Destination slot " << destination_slot << " not found" << std::endl;
        return false;
    }

    // Check if route already exists
    for (const auto& route : matrix_routes_) {
        if (route.source_slot == source_slot && route.destination_slot == destination_slot) {
            std::cout << "Route from slot " << source_slot << " to destination " << destination_slot << " already exists" << std::endl;
            return true; // Route already exists, no need to create
        }
    }

    // Remove any existing route to this destination (destinations can still only receive from one source)
    matrix_routes_.erase(
        std::remove_if(matrix_routes_.begin(), matrix_routes_.end(),
            [destination_slot](const MatrixRoute& route) {
                return route.destination_slot == destination_slot;
            }),
        matrix_routes_.end()
    );

    MatrixRoute route;
    route.id = GenerateDestinationId(); // Reuse the ID generator
    route.source_slot = source_slot;
    route.destination_slot = destination_slot;
    route.is_active = true;

    matrix_routes_.push_back(route);
    dest->current_source_slot = source_slot;
    
    std::cout << "Created matrix route from slot " << source_slot << " (" << src_slot->assigned_ndi_source << ") to destination slot " << destination_slot << " (" << dest->name << ")" << std::endl;
    return true;
}

bool NDIManager::RemoveMatrixRoute(int source_slot, int destination_slot) {
    for (auto it = matrix_routes_.begin(); it != matrix_routes_.end(); ++it) {
        if (it->source_slot == source_slot && it->destination_slot == destination_slot) {
            // Clear the destination's current source
            MatrixDestination* dest = FindMatrixDestination(destination_slot);
            if (dest) {
                dest->current_source_slot = 0;
            }
            
            std::cout << "Removed matrix route from slot " << source_slot << " to destination slot " << destination_slot << std::endl;
            matrix_routes_.erase(it);
            
            // Receiver cleanup will happen periodically via routing thread
            return true;
        }
    }
    return false;
}

bool NDIManager::UnassignDestination(int destination_slot) {
    try {
        std::cout << "Starting unassign for destination slot " << destination_slot << std::endl;
        
        MatrixDestination* dest = FindMatrixDestination(destination_slot);
        if (!dest) {
            std::cout << "ERROR: Destination slot " << destination_slot << " not found for unassign" << std::endl;
            return false;
        }
        
        std::cout << "Unassigning destination slot " << destination_slot << " (" << dest->name << ")" << std::endl;
        std::cout << "Current source slot before unassign: " << dest->current_source_slot << std::endl;
        
        // Count routes before removal
        size_t routes_before = matrix_routes_.size();
        
        // Remove any routes to this destination
        matrix_routes_.erase(
            std::remove_if(matrix_routes_.begin(), matrix_routes_.end(),
                [destination_slot](const MatrixRoute& route) {
                    std::cout << "Checking route: source " << route.source_slot << " -> dest " << route.destination_slot << " (active: " << route.is_active << ")" << std::endl;
                    return route.destination_slot == destination_slot;
                }),
            matrix_routes_.end()
        );
        
        size_t routes_after = matrix_routes_.size();
        std::cout << "Removed " << (routes_before - routes_after) << " routes (before: " << routes_before << ", after: " << routes_after << ")" << std::endl;
        
        // Clear the destination's current source
        dest->current_source_slot = 0;
        std::cout << "Set destination current_source_slot to 0" << std::endl;
        
        std::cout << "Successfully unassigned destination slot " << destination_slot << std::endl;
        return true;
    } catch (const std::exception& e) {
        std::cout << "ERROR in UnassignDestination: " << e.what() << std::endl;
        return false;
    } catch (...) {
        std::cout << "UNKNOWN ERROR in UnassignDestination" << std::endl;
        return false;
    }
}

std::vector<MatrixRoute> NDIManager::GetMatrixRoutes() {
    return matrix_routes_;
}

// Bulk Routing Operations
bool NDIManager::CreateMultipleRoutes(int source_slot, const std::vector<int>& destination_slots) {
    // Find the source slot
    MatrixSourceSlot* src_slot = FindMatrixSourceSlot(source_slot);
    if (!src_slot || !src_slot->is_assigned) {
        std::cerr << "Source slot " << source_slot << " not found or not assigned" << std::endl;
        return false;
    }
    
    bool all_successful = true;
    int successful_routes = 0;
    
    std::cout << "Creating multiple routes from source slot " << source_slot << " (" << src_slot->assigned_ndi_source << ") to " << destination_slots.size() << " destinations" << std::endl;
    
    for (int dest_slot : destination_slots) {
        if (CreateMatrixRoute(source_slot, dest_slot)) {
            successful_routes++;
        } else {
            all_successful = false;
            std::cerr << "Failed to create route to destination " << dest_slot << std::endl;
        }
    }
    
    std::cout << "Successfully created " << successful_routes << " out of " << destination_slots.size() << " routes from source " << source_slot << std::endl;
    return all_successful;
}

bool NDIManager::RemoveAllRoutesFromSource(int source_slot) {
    int routes_removed = 0;
    
    // Find all destinations that are routed from this source
    std::vector<int> affected_destinations;
    for (const auto& route : matrix_routes_) {
        if (route.source_slot == source_slot) {
            affected_destinations.push_back(route.destination_slot);
        }
    }
    
    // Remove all routes from this source
    matrix_routes_.erase(
        std::remove_if(matrix_routes_.begin(), matrix_routes_.end(),
            [source_slot, &routes_removed](const MatrixRoute& route) {
                if (route.source_slot == source_slot) {
                    routes_removed++;
                    return true;
                }
                return false;
            }),
        matrix_routes_.end()
    );
    
    // Clear current_source_slot for affected destinations
    for (int dest_slot : affected_destinations) {
        MatrixDestination* dest = FindMatrixDestination(dest_slot);
        if (dest) {
            dest->current_source_slot = 0;
        }
    }
    
    std::cout << "Removed " << routes_removed << " routes from source slot " << source_slot << std::endl;
    return routes_removed > 0;
}

std::vector<int> NDIManager::GetDestinationsForSource(int source_slot) {
    std::vector<int> destinations;
    
    for (const auto& route : matrix_routes_) {
        if (route.source_slot == source_slot && route.is_active) {
            destinations.push_back(route.destination_slot);
        }
    }
    
    return destinations;
}

void NDIManager::InitializeDefaultMatrix() {
    // Initialize 16 source slots (empty by default)
    matrix_source_slots_.clear();
    for (int i = 1; i <= 16; ++i) {
        MatrixSourceSlot slot;
        slot.slot_number = i;
        slot.assigned_ndi_source = "";
        slot.display_name = "Slot " + std::to_string(i);
        slot.is_assigned = false;
        matrix_source_slots_.push_back(slot);
    }
    
    // Initialize 4 default destinations with error handling and delay
    matrix_destinations_.clear();
    for (int i = 1; i <= 4; ++i) {
        std::string dest_name = "NDI Output " + std::to_string(i);
        if (!CreateMatrixDestination(dest_name, "Matrix destination " + std::to_string(i))) {
            std::cerr << "WARNING: Failed to create default destination " << i << ", continuing..." << std::endl;
        }
        // Small delay to prevent resource conflicts between NDI sender creations
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    
    std::cout << "Initialized default matrix: 16 source slots, 4 destinations" << std::endl;
}

void NDIManager::SetSourceUpdateCallback(std::function<void(const std::vector<NDISource>&)> callback) {
    source_update_callback_ = callback;
}

std::string NDIManager::GenerateDestinationId() {
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, 15);
    
    std::stringstream ss;
    for (int i = 0; i < 8; ++i) {
        ss << std::hex << dis(gen);
        if (i == 3) ss << "-";
    }
    return ss.str();
}

MatrixDestination* NDIManager::FindMatrixDestination(int slot_number) {
    for (auto& dest : matrix_destinations_) {
        if (dest.slot_number == slot_number) {
            return &dest;
        }
    }
    return nullptr;
}

MatrixSourceSlot* NDIManager::FindMatrixSourceSlot(int slot_number) {
    for (auto& slot : matrix_source_slots_) {
        if (slot.slot_number == slot_number) {
            return &slot;
        }
    }
    return nullptr;
}

NDIlib_recv_instance_t NDIManager::GetOrCreateReceiver(const std::string& source_name) {
    // Check if we already have a receiver for this source
    auto it = route_receivers_.find(source_name);
    if (it != route_receivers_.end() && it->second) {
        return it->second;
    }
    
    // Create new receiver
    std::string recv_name = "Router_Recv_" + source_name;
    
    NDIlib_recv_create_v3_t recv_desc;
    recv_desc.source_to_connect_to.p_ndi_name = source_name.c_str();
    recv_desc.source_to_connect_to.p_url_address = nullptr;
    recv_desc.color_format = NDIlib_recv_color_format_BGRX_BGRA; // Standard format to preserve quality
    recv_desc.bandwidth = NDIlib_recv_bandwidth_highest; // Keep native resolution and quality
    recv_desc.allow_video_fields = false;
    recv_desc.p_ndi_recv_name = recv_name.c_str();

    NDIlib_recv_instance_t receiver = NDIlib_recv_create_v3(&recv_desc);
    if (receiver) {
        route_receivers_[source_name] = receiver;
        std::cout << "Created receiver for source: " << source_name << std::endl;
    }
    
    return receiver;
}

void NDIManager::CleanupUnusedReceivers() {
    try {
        std::cout << "=== STARTING RECEIVER CLEANUP ===" << std::endl;
        std::cout << "Current receivers: " << route_receivers_.size() << std::endl;
        std::cout << "Current routes: " << matrix_routes_.size() << std::endl;
        
        // List all current receivers
        for (const auto& pair : route_receivers_) {
            std::cout << "  Receiver: '" << pair.first << "' -> " << (pair.second ? "valid" : "NULL") << std::endl;
        }
        
        // Find receivers that are no longer used by any route
        std::set<std::string> used_sources;
        std::cout << "Checking which sources are still in use..." << std::endl;
        
        for (const auto& route : matrix_routes_) {
            if (route.is_active) {
                MatrixSourceSlot* src_slot = FindMatrixSourceSlot(route.source_slot);
                if (src_slot && src_slot->is_assigned) {
                    std::cout << "  Route uses source: '" << src_slot->assigned_ndi_source << "'" << std::endl;
                    used_sources.insert(src_slot->assigned_ndi_source);
                }
            }
        }
        
        std::cout << "Found " << used_sources.size() << " sources still in use by active routes" << std::endl;
        
        // Remove unused receivers safely
        std::vector<std::string> receivers_to_remove;
        for (const auto& pair : route_receivers_) {
            if (used_sources.find(pair.first) == used_sources.end()) {
                std::cout << "  Receiver '" << pair.first << "' is unused, marking for removal" << std::endl;
                receivers_to_remove.push_back(pair.first);
            } else {
                std::cout << "  Receiver '" << pair.first << "' is still in use" << std::endl;
            }
        }
        
        std::cout << "Will remove " << receivers_to_remove.size() << " unused receivers" << std::endl;
        
        for (const std::string& source_name : receivers_to_remove) {
            try {
                auto it = route_receivers_.find(source_name);
                if (it != route_receivers_.end()) {
                    if (it->second) {
                        std::cout << "Destroying NDI receiver for: '" << source_name << "'" << std::endl;
                        NDIlib_recv_destroy(it->second);
                        std::cout << "NDI receiver destroyed successfully" << std::endl;
                    } else {
                        std::cout << "Receiver for '" << source_name << "' was already NULL" << std::endl;
                    }
                    route_receivers_.erase(it);
                    std::cout << "Removed receiver entry for: '" << source_name << "'" << std::endl;
                } else {
                    std::cout << "WARNING: Receiver '" << source_name << "' not found in map" << std::endl;
                }
            } catch (const std::exception& e) {
                std::cout << "ERROR destroying receiver '" << source_name << "': " << e.what() << std::endl;
            } catch (...) {
                std::cout << "UNKNOWN ERROR destroying receiver '" << source_name << "'" << std::endl;
            }
        }
        
        std::cout << "=== RECEIVER CLEANUP COMPLETED. Remaining receivers: " << route_receivers_.size() << " ===" << std::endl;
    } catch (const std::exception& e) {
        std::cout << "=== ERROR in CleanupUnusedReceivers: " << e.what() << " ===" << std::endl;
    } catch (...) {
        std::cout << "=== UNKNOWN ERROR in CleanupUnusedReceivers ===" << std::endl;
    }
}

void NDIManager::SendTestFramesToAllDestinations() {
    // Create a simple test frame to make NDI outputs visible on network
    static int frame_counter = 0;
    
    // Create a simple 720p test frame (minimal overhead)
    NDIlib_video_frame_v2_t test_frame;
    test_frame.xres = 1280;
    test_frame.yres = 720;
    test_frame.FourCC = NDIlib_FourCC_type_BGRA;
    test_frame.frame_rate_N = 30;
    test_frame.frame_rate_D = 1;
    test_frame.picture_aspect_ratio = 16.0f / 9.0f;
    test_frame.frame_format_type = NDIlib_frame_format_type_progressive;
    test_frame.timecode = frame_counter * 1000; // Simple timecode
    test_frame.timestamp = 0; // Let NDI handle timestamp
    
    // Allocate minimal buffer (black frame)
    size_t buffer_size = test_frame.xres * test_frame.yres * 4; // BGRA = 4 bytes per pixel
    test_frame.p_data = (uint8_t*)malloc(buffer_size);
    test_frame.line_stride_in_bytes = test_frame.xres * 4;
    
    if (test_frame.p_data) {
        // Fill with black (all zeros for BGRA black)
        memset(test_frame.p_data, 0, buffer_size);
        
        // Send test frame to all destinations to make them visible
        for (const auto& dest : matrix_destinations_) {
            if (dest.ndi_sender) {
                NDIlib_send_send_video_v2(dest.ndi_sender, &test_frame);
            }
        }
        
        free(test_frame.p_data);
        frame_counter++;
        
        static int last_log_frame = 0;
        if (frame_counter - last_log_frame >= 300) { // Log every 10 seconds at 30fps
            std::cout << "Sent test frames to " << matrix_destinations_.size() 
                      << " destinations to maintain network visibility" << std::endl;
            last_log_frame = frame_counter;
        }
    }
}

void NDIManager::ProcessRoutes() {
    std::cout << "Matrix routing thread started" << std::endl;
    
    // Debug: Show routing status
    static int debug_counter = 0;
    static auto last_debug_time = std::chrono::steady_clock::now();
    
    while (!should_stop_routing_) {
        // Check if we should pause for route updates
        if (is_updating_routes_) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
            continue;
        }
        
        // Debug output every 10 seconds
        auto current_time = std::chrono::steady_clock::now();
        if (std::chrono::duration_cast<std::chrono::seconds>(current_time - last_debug_time).count() >= 10) {
            std::cout << "Routing status: " << matrix_routes_.size() << " routes, " 
                      << matrix_destinations_.size() << " destinations" << std::endl;
            
            // Show destination status
            for (const auto& dest : matrix_destinations_) {
                std::cout << "  Destination '" << dest.name << "' slot " << dest.slot_number 
                          << " - sender: " << (dest.ndi_sender ? "OK" : "FAILED") << std::endl;
            }
            
            // Send test frames to make outputs visible on network
            if (matrix_routes_.empty()) {
                SendTestFramesToAllDestinations();
            }
            
            last_debug_time = current_time;
        }
        
        // Group routes by source to process frames efficiently
        std::map<std::string, std::vector<MatrixDestination*>> source_to_destinations;
        
        for (const auto& route : matrix_routes_) {
            if (!route.is_active) continue;
            
            // Find the source slot
            MatrixSourceSlot* src_slot = FindMatrixSourceSlot(route.source_slot);
            if (!src_slot || !src_slot->is_assigned) continue;
            
            // Find the destination
            MatrixDestination* dest = FindMatrixDestination(route.destination_slot);
            if (!dest || !dest->ndi_sender) continue;
            
            // Group destinations by source
            source_to_destinations[src_slot->assigned_ndi_source].push_back(dest);
        }
        
        // Process each unique source once
        for (const auto& source_group : source_to_destinations) {
            const std::string& source_name = source_group.first;
            const std::vector<MatrixDestination*>& destinations = source_group.second;
            
            // Get or create persistent receiver for this source
            NDIlib_recv_instance_t receiver = GetOrCreateReceiver(source_name);
            
            if (receiver) {
                // Try to receive frames
                NDIlib_video_frame_v2_t video_frame;
                NDIlib_audio_frame_v2_t audio_frame;
                
                switch (NDIlib_recv_capture_v2(receiver, &video_frame, &audio_frame, nullptr, 1)) { // 1ms timeout for non-blocking
                    case NDIlib_frame_type_video:
                        // Send the same video frame to all destinations using this source
                        for (MatrixDestination* dest : destinations) {
                            NDIlib_send_send_video_v2(dest->ndi_sender, &video_frame);
                        }
                        NDIlib_recv_free_video_v2(receiver, &video_frame);
                        break;
                        
                    case NDIlib_frame_type_audio:
                        // Send the same audio frame to all destinations using this source
                        for (MatrixDestination* dest : destinations) {
                            NDIlib_send_send_audio_v2(dest->ndi_sender, &audio_frame);
                        }
                        NDIlib_recv_free_audio_v2(receiver, &audio_frame);
                        break;
                        
                    default:
                        // No frame available, continue
                        break;
                }
            }
        }
        
        // Clean up unused receivers periodically (every 5 seconds)
        static auto last_cleanup = std::chrono::steady_clock::now();
        auto now = std::chrono::steady_clock::now();
        if (std::chrono::duration_cast<std::chrono::seconds>(now - last_cleanup).count() >= 5) {
            CleanupUnusedReceivers();
            last_cleanup = now;
        }
        
        // Balanced delay for low latency without excessive CPU usage
        std::this_thread::sleep_for(std::chrono::milliseconds(1)); // 1ms for good latency with reasonable CPU usage
    }
    
    std::cout << "Matrix routing thread stopped" << std::endl;
}

// Preview Monitor Implementation
bool NDIManager::SetPreviewSource(const std::string& source_name) {
    std::cout << "Setting preview source to: " << source_name << std::endl;
    
    // Clear current preview with a small delay to ensure clean shutdown
    ClearPreviewSource();
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    
    // Find the source
    auto sources = DiscoverSources();
    NDIlib_source_t target_source;
    bool source_found = false;
    
    for (const auto& source : sources) {
        if (source.name == source_name) {
            // Create NDI source structure (not static to avoid race conditions)
            target_source.p_ndi_name = source.name.c_str();
            target_source.p_url_address = source.url.empty() ? nullptr : source.url.c_str();
            source_found = true;
            break;
        }
    }
    
    if (!source_found) {
        std::cout << "Preview source not found: " << source_name << std::endl;
        return false;
    }
    
    // Create preview receiver with balanced settings (lower bandwidth for preview is acceptable)
    NDIlib_recv_create_v3_t recv_desc;
    recv_desc.source_to_connect_to = target_source;
    recv_desc.allow_video_fields = false;
    recv_desc.bandwidth = NDIlib_recv_bandwidth_lowest;  // Lower bandwidth acceptable for preview
    recv_desc.color_format = NDIlib_recv_color_format_BGRX_BGRA; // Standard format for preview
    
    preview_receiver_ = NDIlib_recv_create_v3(&recv_desc);
    if (!preview_receiver_) {
        std::cout << "Failed to create preview receiver for: " << source_name << std::endl;
        return false;
    }
    
    current_preview_source_ = source_name;
    std::cout << "Preview receiver created for: " << source_name << std::endl;
    return true;
}

std::string NDIManager::GetPreviewSource() {
    return current_preview_source_;
}

void NDIManager::ClearPreviewSource() {
    if (preview_receiver_) {
        std::cout << "Clearing preview receiver for: " << current_preview_source_ << std::endl;
        
        // Give any ongoing capture operations a moment to complete
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
        
        NDIlib_recv_destroy(preview_receiver_);
        preview_receiver_ = nullptr;
        
        // Small delay to ensure clean shutdown
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }
    current_preview_source_.clear();
}

std::vector<uint8_t> NDIManager::CapturePreviewFrame() {
    std::vector<uint8_t> result;
    
    if (!preview_receiver_) {
        return result;  // Empty vector indicates no preview source
    }
    
    // Limit preview to 24fps for stability
    static auto last_frame_time = std::chrono::steady_clock::now();
    auto now = std::chrono::steady_clock::now();
    auto time_since_last = std::chrono::duration_cast<std::chrono::milliseconds>(now - last_frame_time);
    
    // 24fps = ~42ms between frames
    if (time_since_last.count() < 42) {
        return result;  // Too soon for next frame
    }
    
    NDIlib_video_frame_v2_t video_frame;
    
    // Double-check receiver is still valid (could be cleared during switching)
    if (!preview_receiver_) {
        return result;
    }
    
    // Try to capture a frame with minimal timeout for low latency
    switch (NDIlib_recv_capture_v2(preview_receiver_, &video_frame, nullptr, nullptr, 1)) {
        case NDIlib_frame_type_video:
            {
                // We have a video frame - create a simple RGB snapshot
                // For now, create a simple representation
                // In a real implementation, you'd convert to JPEG here
                
                int width = video_frame.xres;
                int height = video_frame.yres;
                
                // Create a simple header with dimensions (8 bytes: 4 for width, 4 for height)
                result.resize(8 + width * height * 3);  // RGB data
                
                // Write dimensions
                *reinterpret_cast<uint32_t*>(&result[0]) = width;
                *reinterpret_cast<uint32_t*>(&result[4]) = height;
                
                // Convert from BGRA to RGB (simplified)
                uint8_t* src = static_cast<uint8_t*>(video_frame.p_data);
                uint8_t* dst = &result[8];
                
                for (int i = 0; i < width * height; i++) {
                    dst[i * 3 + 0] = src[i * 4 + 2];  // R = B
                    dst[i * 3 + 1] = src[i * 4 + 1];  // G = G  
                    dst[i * 3 + 2] = src[i * 4 + 0];  // B = R
                }
                
                // Update frame time for rate limiting
                last_frame_time = now;
                // std::cout << "Captured preview frame: " << width << "x" << height << std::endl;
            }
            break;
            
        case NDIlib_frame_type_none:
        default:
            // No frame available
            break;
    }
    
    // Free the video frame (check receiver is still valid)
    if (video_frame.p_data && preview_receiver_) {
        NDIlib_recv_free_video_v2(preview_receiver_, &video_frame);
    }
    
    return result;
}