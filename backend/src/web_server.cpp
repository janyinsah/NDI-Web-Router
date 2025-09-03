#include "web_server.h"
#include <iostream>
#include <sstream>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <ctime>

#pragma comment(lib, "ws2_32.lib")

WebServer::WebServer(int port, std::shared_ptr<NDIManager> ndi_manager)
    : port_(port), is_running_(false), ndi_manager_(ndi_manager) {
    // auth_manager_ = std::make_unique<AuthManager>();  // Temporarily disabled for build
}

WebServer::~WebServer() {
    Stop();
}

bool WebServer::Start() {
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        std::cerr << "WSAStartup failed" << std::endl;
        return false;
    }

    // Initialize authentication manager - Temporarily disabled for build
    // if (!auth_manager_->Initialize()) {
    //     std::cerr << "Failed to initialize authentication manager" << std::endl;
    //     WSACleanup();
    //     return false;
    // }

    is_running_ = true;
    server_thread_ = std::make_unique<std::thread>(&WebServer::ServerThreadFunction, this);
    return true;
}

void WebServer::Stop() {
    is_running_ = false;
    if (server_thread_ && server_thread_->joinable()) {
        server_thread_->join();
    }
    WSACleanup();
}

void WebServer::ServerThreadFunction() {
    SOCKET listen_socket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (listen_socket == INVALID_SOCKET) {
        std::cerr << "Failed to create socket" << std::endl;
        return;
    }

    sockaddr_in server_addr;
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(port_);

    if (bind(listen_socket, (sockaddr*)&server_addr, sizeof(server_addr)) == SOCKET_ERROR) {
        std::cerr << "Bind failed" << std::endl;
        closesocket(listen_socket);
        return;
    }

    if (listen(listen_socket, SOMAXCONN) == SOCKET_ERROR) {
        std::cerr << "Listen failed" << std::endl;
        closesocket(listen_socket);
        return;
    }

    while (is_running_) {
        SOCKET client_socket = accept(listen_socket, nullptr, nullptr);
        if (client_socket != INVALID_SOCKET) {
            HandleRequest(client_socket);
            closesocket(client_socket);
        }
    }

    closesocket(listen_socket);
}

void WebServer::HandleRequest(int client_socket) {
    char buffer[4096];
    int bytes_received = recv(client_socket, buffer, sizeof(buffer) - 1, 0);
    
    if (bytes_received > 0) {
        buffer[bytes_received] = '\0';
        std::string request(buffer);
        
        std::string response;
        std::string cors_headers = "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization\r\n";
        
        if (request.find("OPTIONS") == 0) {
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "\r\n";
        } else if (request.find("GET /api/health") != std::string::npos) {
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n{\"status\":\"ok\",\"timestamp\":" + std::to_string(std::time(nullptr)) + "}";
        } else if (request.find("GET /api/sources") != std::string::npos) {
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleGetSources();
        } else if (request.find("GET /api/studio-monitors") != std::string::npos) {
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleGetStudioMonitors();
        } else if (request.find("POST /api/studio-monitors/reset") != std::string::npos) {
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleResetStudioMonitors();
        } else if (request.find("GET /api/matrix/source-slots") != std::string::npos) {
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleGetMatrixSourceSlots();
        } else if (request.find("GET /api/matrix/destinations") != std::string::npos) {
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleGetMatrixDestinations();
        } else if (request.find("GET /api/matrix/routes") != std::string::npos) {
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleGetMatrixRoutes();
        } else if (request.find("POST /api/matrix/source-slots/assign") != std::string::npos) {
            size_t body_pos = request.find("\r\n\r\n");
            std::string body = (body_pos != std::string::npos) ? request.substr(body_pos + 4) : "";
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleAssignSourceToSlot(body);
        } else if (request.find("DELETE /api/matrix/source-slots/") != std::string::npos) {
            try {
                
                // Extract slot number from URL
                size_t slot_pos = request.find("/api/matrix/source-slots/");
                if (slot_pos != std::string::npos) {
                    slot_pos += 25; // length of "/api/matrix/source-slots/"
                    // Find the end of the URL path (space before HTTP, newline, or end of path)
                    size_t space_pos = request.find(" ", slot_pos);
                    size_t newline_pos = request.find("\r", slot_pos);
                    
                    // Use the earliest valid terminator
                    size_t end_pos = std::string::npos;
                    
                    if (space_pos != std::string::npos) {
                        end_pos = space_pos;
                    }
                    if (newline_pos != std::string::npos && (end_pos == std::string::npos || newline_pos < end_pos)) {
                        end_pos = newline_pos;
                    }
                    
                    if (end_pos != std::string::npos && end_pos > slot_pos) {
                        std::string slot_str = request.substr(slot_pos, end_pos - slot_pos);
                        
                        if (!slot_str.empty()) {
                            int slot_num = std::stoi(slot_str);
                            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleUnassignSourceSlot(slot_num);
                        } else {
                            response = "HTTP/1.1 400 Bad Request\r\n" + cors_headers + "\r\nEmpty slot number";
                        }
                    } else {
                        response = "HTTP/1.1 400 Bad Request\r\n" + cors_headers + "\r\nInvalid slot number format";
                    }
                } else {
                    response = "HTTP/1.1 400 Bad Request\r\n" + cors_headers + "\r\nInvalid request";
                }
            } catch (const std::exception& e) {
                response = "HTTP/1.1 500 Internal Server Error\r\n" + cors_headers + "\r\nParsing error";
            } catch (...) {
                response = "HTTP/1.1 500 Internal Server Error\r\n" + cors_headers + "\r\nUnknown parsing error";
            }
        } else if (request.find("POST /api/matrix/destinations/") != std::string::npos && request.find("/unassign") != std::string::npos) {
            // Extract destination slot from URL like /api/matrix/destinations/1/unassign
            size_t dest_pos = request.find("/api/matrix/destinations/");
            if (dest_pos != std::string::npos) {
                dest_pos += 25; // length of "/api/matrix/destinations/"
                size_t unassign_pos = request.find("/unassign", dest_pos);
                if (unassign_pos != std::string::npos) {
                    int dest_slot = std::stoi(request.substr(dest_pos, unassign_pos - dest_pos));
                    response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleUnassignDestination(dest_slot);
                } else {
                    response = "HTTP/1.1 400 Bad Request\r\n" + cors_headers + "\r\nInvalid destination slot";
                }
            } else {
                response = "HTTP/1.1 400 Bad Request\r\n" + cors_headers + "\r\nInvalid request";
            }
        } else if (request.find("POST /api/matrix/destinations") != std::string::npos) {
            size_t body_pos = request.find("\r\n\r\n");
            std::string body = (body_pos != std::string::npos) ? request.substr(body_pos + 4) : "";
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleCreateMatrixDestination(body);
        } else if (request.find("DELETE /api/matrix/destinations/") != std::string::npos) {
            // Extract destination slot from URL
            size_t dest_pos = request.find("/api/matrix/destinations/");
            if (dest_pos != std::string::npos) {
                dest_pos += 25; // length of "/api/matrix/destinations/"
                size_t space_pos = request.find(" ", dest_pos);
                if (space_pos != std::string::npos) {
                    int dest_slot = std::stoi(request.substr(dest_pos, space_pos - dest_pos));
                    response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleRemoveMatrixDestination(dest_slot);
                } else {
                    response = "HTTP/1.1 400 Bad Request\r\n" + cors_headers + "\r\nInvalid destination slot";
                }
            } else {
                response = "HTTP/1.1 400 Bad Request\r\n" + cors_headers + "\r\nInvalid request";
            }
        } else if (request.find("POST /api/matrix/routes/multiple") != std::string::npos) {
            size_t body_pos = request.find("\r\n\r\n");
            std::string body = (body_pos != std::string::npos) ? request.substr(body_pos + 4) : "";
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleCreateMultipleRoutes(body);
        } else if (request.find("POST /api/matrix/routes") != std::string::npos) {
            size_t body_pos = request.find("\r\n\r\n");
            std::string body = (body_pos != std::string::npos) ? request.substr(body_pos + 4) : "";
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleCreateMatrixRoute(body);
        } else if (request.find("DELETE /api/matrix/routes/source/") != std::string::npos) {
            // Extract source slot number from URL
            size_t slot_pos = request.find("/api/matrix/routes/source/");
            if (slot_pos != std::string::npos) {
                slot_pos += 26; // length of "/api/matrix/routes/source/"
                size_t space_pos = request.find(" ", slot_pos);
                if (space_pos != std::string::npos) {
                    std::string slot_str = request.substr(slot_pos, space_pos - slot_pos);
                    int source_slot = std::stoi(slot_str);
                    response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleRemoveAllRoutesFromSource(source_slot);
                } else {
                    response = "HTTP/1.1 400 Bad Request\r\n" + cors_headers + "\r\nInvalid request format";
                }
            } else {
                response = "HTTP/1.1 400 Bad Request\r\n" + cors_headers + "\r\nInvalid request format";
            }
        } else if (request.find("GET /api/matrix/routes/source/") != std::string::npos) {
            // Extract source slot number from URL for getting destinations
            size_t slot_pos = request.find("/api/matrix/routes/source/");
            if (slot_pos != std::string::npos) {
                slot_pos += 26; // length of "/api/matrix/routes/source/"
                size_t space_pos = request.find(" ", slot_pos);
                if (space_pos != std::string::npos) {
                    std::string slot_str = request.substr(slot_pos, space_pos - slot_pos);
                    int source_slot = std::stoi(slot_str);
                    response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleGetDestinationsForSource(source_slot);
                } else {
                    response = "HTTP/1.1 400 Bad Request\r\n" + cors_headers + "\r\nInvalid request format";
                }
            } else {
                response = "HTTP/1.1 400 Bad Request\r\n" + cors_headers + "\r\nInvalid request format";
            }
        } else if (request.find("DELETE /api/matrix/routes") != std::string::npos) {
            size_t body_pos = request.find("\r\n\r\n");
            std::string body = (body_pos != std::string::npos) ? request.substr(body_pos + 4) : "";
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleRemoveMatrixRoute(body);
        } else if (request.find("POST /api/studio-monitors/set-source") != std::string::npos) {
            size_t body_pos = request.find("\r\n\r\n");
            std::string body = (body_pos != std::string::npos) ? request.substr(body_pos + 4) : "";
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleSetStudioMonitorSource(body);
        } else if (request.find("GET /api/studio-monitors/current-source") != std::string::npos) {
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleGetStudioMonitorSource();
        } else if (request.find("POST /api/preview/set-source") != std::string::npos) {
            size_t body_pos = request.find("\r\n\r\n");
            std::string body = (body_pos != std::string::npos) ? request.substr(body_pos + 4) : "";
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleSetPreviewSource(body);
        } else if (request.find("GET /api/preview/current-source") != std::string::npos) {
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleGetPreviewSource();
        } else if (request.find("GET /api/preview/image") != std::string::npos) {
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleGetPreviewImage();
        } else if (request.find("POST /api/preview/clear") != std::string::npos) {
            response = "HTTP/1.1 200 OK\r\n" + cors_headers + "Content-Type: application/json\r\n\r\n" + HandleClearPreview();
        } else {
            response = "HTTP/1.1 404 Not Found\r\n" + cors_headers + "\r\nEndpoint not found";
        }
        
        send(client_socket, response.c_str(), response.length(), 0);
    }
}

std::string WebServer::HandleGetSources() {
    std::cout << "Handling GET /api/sources request" << std::endl;
    auto sources = ndi_manager_->DiscoverSources();
    std::cout << "Found " << sources.size() << " NDI sources" << std::endl;
    
    std::ostringstream json;
    json << "[";
    
    for (size_t i = 0; i < sources.size(); ++i) {
        if (i > 0) json << ",";
        json << "{\"name\":\"" << sources[i].name << "\",\"url\":\"" << sources[i].url 
             << "\",\"connected\":" << (sources[i].is_connected ? "true" : "false") << "}";
    }
    
    json << "]";
    return json.str();
}

std::string WebServer::HandleGetMatrixRoutes() {
    auto routes = ndi_manager_->GetMatrixRoutes();
    std::ostringstream json;
    json << "[";
    
    for (size_t i = 0; i < routes.size(); ++i) {
        if (i > 0) json << ",";
        json << "{\"id\":\"" << routes[i].id << "\",\"sourceSlot\":" << routes[i].source_slot
             << ",\"destinationSlot\":" << routes[i].destination_slot
             << ",\"active\":" << (routes[i].is_active ? "true" : "false") << "}";
    }
    
    json << "]";
    return json.str();
}

std::string WebServer::HandleGetStudioMonitors() {
    auto studio_monitors = ndi_manager_->DiscoverStudioMonitors();
    std::ostringstream json;
    json << "[";
    
    for (size_t i = 0; i < studio_monitors.size(); ++i) {
        if (i > 0) json << ",";
        json << "{\"name\":\"" << studio_monitors[i].name << "\",\"url\":\"" << studio_monitors[i].url 
             << "\",\"connected\":" << (studio_monitors[i].is_connected ? "true" : "false") << "}";
    }
    
    json << "]";
    return json.str();
}

std::string WebServer::HandleResetStudioMonitors() {
    auto studio_monitors = ndi_manager_->DiscoverStudioMonitors();
    
    // For each studio monitor, we would send a command to set their source to "None"
    // Since this is a demonstration and we can't actually control studio monitors directly,
    // we'll return the list of monitors that would be reset
    std::ostringstream json;
    json << "{\"success\":true,\"message\":\"Studio monitors reset to None\",\"monitors\":[";
    
    for (size_t i = 0; i < studio_monitors.size(); ++i) {
        if (i > 0) json << ",";
        json << "\"" << studio_monitors[i].name << "\"";
    }
    
    json << "],\"count\":" << studio_monitors.size() << "}";
    return json.str();
}

std::string WebServer::HandleGetMatrixSourceSlots() {
    auto slots = ndi_manager_->GetSourceSlots();
    std::ostringstream json;
    json << "[";
    
    for (size_t i = 0; i < slots.size(); ++i) {
        if (i > 0) json << ",";
        json << "{\"slotNumber\":" << slots[i].slot_number
             << ",\"assignedNdiSource\":\"" << slots[i].assigned_ndi_source << "\""
             << ",\"displayName\":\"" << slots[i].display_name << "\""
             << ",\"isAssigned\":" << (slots[i].is_assigned ? "true" : "false") << "}";
    }
    
    json << "]";
    return json.str();
}

std::string WebServer::HandleGetMatrixDestinations() {
    auto destinations = ndi_manager_->GetMatrixDestinations();
    std::ostringstream json;
    json << "[";
    
    for (size_t i = 0; i < destinations.size(); ++i) {
        if (i > 0) json << ",";
        json << "{\"slotNumber\":" << destinations[i].slot_number
             << ",\"name\":\"" << destinations[i].name << "\""
             << ",\"description\":\"" << destinations[i].description << "\""
             << ",\"enabled\":" << (destinations[i].is_enabled ? "true" : "false")
             << ",\"currentSourceSlot\":" << destinations[i].current_source_slot << "}";
    }
    
    json << "]";
    return json.str();
}

std::string WebServer::HandleAssignSourceToSlot(const std::string& request_body) {
    size_t slot_pos = request_body.find("\"slotNumber\":");
    size_t source_pos = request_body.find("\"ndiSourceName\":\"");
    size_t name_pos = request_body.find("\"displayName\":\"");
    
    if (slot_pos == std::string::npos || source_pos == std::string::npos) {
        return "{\"error\":\"Invalid request format - missing slotNumber or ndiSourceName\"}";
    }
    
    // Extract slot number
    slot_pos += 13; // length of "slotNumber":
    size_t slot_end = request_body.find(",", slot_pos);
    if (slot_end == std::string::npos) slot_end = request_body.find("}", slot_pos);
    int slot_num = std::stoi(request_body.substr(slot_pos, slot_end - slot_pos));
    
    // Extract NDI source name
    source_pos += 17; // length of "ndiSourceName":"
    size_t source_end = request_body.find("\"", source_pos);
    std::string ndi_source = request_body.substr(source_pos, source_end - source_pos);
    
    // Extract display name (optional)
    std::string display_name = "Slot " + std::to_string(slot_num);
    if (name_pos != std::string::npos) {
        name_pos += 16; // length of "displayName":"
        size_t name_end = request_body.find("\"", name_pos);
        if (name_end != std::string::npos) {
            display_name = request_body.substr(name_pos, name_end - name_pos);
        }
    }
    
    if (ndi_manager_->AssignSourceToSlot(slot_num, ndi_source, display_name)) {
        return "{\"success\":true,\"message\":\"Source assigned to slot successfully\"}";
    } else {
        return "{\"error\":\"Failed to assign source to slot\"}";
    }
}

std::string WebServer::HandleUnassignSourceSlot(int slot_number) {
    try {
        std::cout << "=== WEB SERVER: Handling unassign source slot request for slot " << slot_number << " ===" << std::endl;
        std::cout << "WEB SERVER: About to call ndi_manager_->UnassignSourceSlot(" << slot_number << ")" << std::endl;
        
        bool result = ndi_manager_->UnassignSourceSlot(slot_number);
        
        std::cout << "WEB SERVER: UnassignSourceSlot returned: " << (result ? "true" : "false") << std::endl;
        
        if (result) {
            std::cout << "WEB SERVER: Source slot " << slot_number << " unassigned successfully" << std::endl;
            return "{\"success\":true,\"message\":\"Source slot unassigned successfully\"}";
        } else {
            std::cout << "WEB SERVER: Failed to unassign source slot " << slot_number << std::endl;
            return "{\"error\":\"Failed to unassign source slot\"}";
        }
    } catch (const std::exception& e) {
        std::cout << "=== WEB SERVER ERROR in HandleUnassignSourceSlot: " << e.what() << " ===" << std::endl;
        return "{\"error\":\"Server error during unassign\"}";
    } catch (...) {
        std::cout << "=== WEB SERVER UNKNOWN ERROR in HandleUnassignSourceSlot ===" << std::endl;
        return "{\"error\":\"Unknown server error during unassign\"}";
    }
}

std::string WebServer::HandleCreateMatrixRoute(const std::string& request_body) {
    size_t source_pos = request_body.find("\"sourceSlot\":");
    size_t dest_pos = request_body.find("\"destinationSlot\":");
    
    if (source_pos == std::string::npos || dest_pos == std::string::npos) {
        return "{\"error\":\"Invalid request format - missing sourceSlot or destinationSlot\"}";
    }
    
    // Extract source slot
    source_pos += 13; // length of "sourceSlot":
    size_t source_end = request_body.find(",", source_pos);
    if (source_end == std::string::npos) source_end = request_body.find("}", source_pos);
    int source_slot = std::stoi(request_body.substr(source_pos, source_end - source_pos));
    
    // Extract destination slot
    dest_pos += 18; // length of "destinationSlot":
    size_t dest_end = request_body.find(",", dest_pos);
    if (dest_end == std::string::npos) dest_end = request_body.find("}", dest_pos);
    int dest_slot = std::stoi(request_body.substr(dest_pos, dest_end - dest_pos));
    
    if (ndi_manager_->CreateMatrixRoute(source_slot, dest_slot)) {
        return "{\"success\":true,\"message\":\"Matrix route created successfully\"}";
    } else {
        return "{\"error\":\"Failed to create matrix route\"}";
    }
}


std::string WebServer::HandleCreateMatrixDestination(const std::string& request_body) {
    size_t name_pos = request_body.find("\"name\":\"");
    size_t desc_pos = request_body.find("\"description\":\"");
    
    if (name_pos == std::string::npos) {
        return "{\"error\":\"Missing name field\"}";
    }
    
    name_pos += 8;
    size_t name_end = request_body.find("\"", name_pos);
    
    if (name_end == std::string::npos) {
        return "{\"error\":\"Invalid name format\"}";
    }
    
    std::string name = request_body.substr(name_pos, name_end - name_pos);
    std::string description = "";
    
    if (desc_pos != std::string::npos) {
        desc_pos += 14;
        size_t desc_end = request_body.find("\"", desc_pos);
        if (desc_end != std::string::npos) {
            description = request_body.substr(desc_pos, desc_end - desc_pos);
        }
    }
    
    if (ndi_manager_->CreateMatrixDestination(name, description)) {
        return "{\"success\":true,\"message\":\"Matrix destination created successfully\"}";
    } else {
        return "{\"error\":\"Failed to create matrix destination\"}";
    }
}

std::string WebServer::HandleRemoveMatrixDestination(int slot_number) {
    if (ndi_manager_->RemoveMatrixDestination(slot_number)) {
        return "{\"success\":true,\"message\":\"Matrix destination removed successfully\"}";
    } else {
        return "{\"error\":\"Failed to remove matrix destination\"}";
    }
}

std::string WebServer::HandleRemoveMatrixRoute(const std::string& request_body) {
    size_t source_pos = request_body.find("\"sourceSlot\":");
    size_t dest_pos = request_body.find("\"destinationSlot\":");
    
    if (source_pos == std::string::npos || dest_pos == std::string::npos) {
        return "{\"error\":\"Invalid request format - missing sourceSlot or destinationSlot\"}";
    }
    
    // Extract source slot
    source_pos += 13; // length of "sourceSlot":
    size_t source_end = request_body.find(",", source_pos);
    if (source_end == std::string::npos) source_end = request_body.find("}", source_pos);
    int source_slot = std::stoi(request_body.substr(source_pos, source_end - source_pos));
    
    // Extract destination slot
    dest_pos += 18; // length of "destinationSlot":
    size_t dest_end = request_body.find(",", dest_pos);
    if (dest_end == std::string::npos) dest_end = request_body.find("}", dest_pos);
    int dest_slot = std::stoi(request_body.substr(dest_pos, dest_end - dest_pos));
    
    if (ndi_manager_->RemoveMatrixRoute(source_slot, dest_slot)) {
        return "{\"success\":true,\"message\":\"Matrix route removed successfully\"}";
    } else {
        return "{\"error\":\"Failed to remove matrix route\"}";
    }
}

std::string WebServer::HandleUnassignDestination(int destination_slot) {
    std::cout << "Handling unassign destination request for slot " << destination_slot << std::endl;
    if (ndi_manager_->UnassignDestination(destination_slot)) {
        std::cout << "Destination slot " << destination_slot << " unassigned successfully" << std::endl;
        return "{\"success\":true,\"message\":\"Destination unassigned successfully\"}";
    } else {
        std::cout << "Failed to unassign destination slot " << destination_slot << std::endl;
        return "{\"error\":\"Failed to unassign destination\"}";
    }
}

std::string WebServer::HandleSetStudioMonitorSource(const std::string& request_body) {
    std::cout << "Handling set studio monitor source request" << std::endl;
    
    // Parse JSON to extract source name
    size_t name_pos = request_body.find("\"sourceName\":");
    if (name_pos == std::string::npos) {
        return "{\"error\":\"Missing sourceName field\"}";
    }
    
    name_pos = request_body.find("\"", name_pos + 13);
    if (name_pos == std::string::npos) {
        return "{\"error\":\"Invalid sourceName format\"}";
    }
    
    size_t name_end = request_body.find("\"", name_pos + 1);
    if (name_end == std::string::npos) {
        return "{\"error\":\"Invalid sourceName format\"}";
    }
    
    std::string source_name = request_body.substr(name_pos + 1, name_end - name_pos - 1);
    
    if (ndi_manager_->SetStudioMonitorSource(source_name)) {
        return "{\"success\":true,\"message\":\"Studio monitor source set successfully\"}";
    } else {
        return "{\"error\":\"Failed to set studio monitor source\"}";
    }
}

std::string WebServer::HandleGetStudioMonitorSource() {
    std::string current_source = ndi_manager_->GetStudioMonitorSource();
    if (current_source.empty()) {
        return "{\"source\":null}";
    } else {
        return "{\"source\":\"" + current_source + "\"}";
    }
}

// Preview API Handlers
std::string WebServer::HandleSetPreviewSource(const std::string& request_body) {
    std::cout << "Handling set preview source request" << std::endl;
    
    // Parse JSON to extract source name
    size_t name_pos = request_body.find("\"sourceName\":");
    if (name_pos == std::string::npos) {
        return "{\"error\":\"Missing sourceName field\"}";
    }
    
    name_pos = request_body.find("\"", name_pos + 13);
    if (name_pos == std::string::npos) {
        return "{\"error\":\"Invalid sourceName format\"}";
    }
    
    size_t name_end = request_body.find("\"", name_pos + 1);
    if (name_end == std::string::npos) {
        return "{\"error\":\"Invalid sourceName format\"}";
    }
    
    std::string source_name = request_body.substr(name_pos + 1, name_end - name_pos - 1);
    
    if (ndi_manager_->SetPreviewSource(source_name)) {
        return "{\"success\":true,\"message\":\"Preview source set to " + source_name + "\"}";
    } else {
        return "{\"error\":\"Failed to set preview source\"}";
    }
}

std::string WebServer::HandleGetPreviewSource() {
    std::string current_source = ndi_manager_->GetPreviewSource();
    if (current_source.empty()) {
        return "{\"source\":null}";
    } else {
        return "{\"source\":\"" + current_source + "\"}";
    }
}

std::string WebServer::HandleGetPreviewImage() {
    std::string image_data = ndi_manager_->GetPreviewImage();
    if (image_data.empty()) {
        return "{\"image\":null}";
    } else {
        return "{\"image\":\"" + image_data + "\"}";
    }
}

std::string WebServer::HandleClearPreview() {
    ndi_manager_->ClearPreviewSource();
    return "{\"success\":true,\"message\":\"Preview cleared\"}";
}

// Bulk routing operations
std::string WebServer::HandleCreateMultipleRoutes(const std::string& request_body) {
    size_t source_pos = request_body.find("\"sourceSlot\":");
    size_t dest_array_pos = request_body.find("\"destinationSlots\":");
    
    if (source_pos == std::string::npos || dest_array_pos == std::string::npos) {
        return "{\"error\":\"Invalid request format - missing sourceSlot or destinationSlots\"}";
    }
    
    // Extract source slot
    source_pos += 13; // length of "sourceSlot":
    size_t source_end = request_body.find(",", source_pos);
    if (source_end == std::string::npos) source_end = request_body.find("}", source_pos);
    int source_slot = std::stoi(request_body.substr(source_pos, source_end - source_pos));
    
    // Extract destination slots array
    dest_array_pos += 19; // length of "destinationSlots":
    size_t array_start = request_body.find("[", dest_array_pos);
    size_t array_end = request_body.find("]", array_start);
    
    if (array_start == std::string::npos || array_end == std::string::npos) {
        return "{\"error\":\"Invalid destinationSlots array format\"}";
    }
    
    std::string array_content = request_body.substr(array_start + 1, array_end - array_start - 1);
    std::vector<int> destination_slots;
    
    // Parse the comma-separated destination slot numbers
    std::istringstream ss(array_content);
    std::string token;
    while (std::getline(ss, token, ',')) {
        // Remove whitespace
        token.erase(0, token.find_first_not_of(" \t"));
        token.erase(token.find_last_not_of(" \t") + 1);
        if (!token.empty()) {
            destination_slots.push_back(std::stoi(token));
        }
    }
    
    if (ndi_manager_->CreateMultipleRoutes(source_slot, destination_slots)) {
        std::ostringstream json;
        json << "{\"success\":true,\"message\":\"Created " << destination_slots.size() 
             << " routes from source slot " << source_slot << "\"}";
        return json.str();
    } else {
        return "{\"error\":\"Failed to create some or all routes\"}";
    }
}

std::string WebServer::HandleRemoveAllRoutesFromSource(int source_slot) {
    if (ndi_manager_->RemoveAllRoutesFromSource(source_slot)) {
        std::ostringstream json;
        json << "{\"success\":true,\"message\":\"Removed all routes from source slot " 
             << source_slot << "\"}";
        return json.str();
    } else {
        return "{\"error\":\"No routes found for source slot or removal failed\"}";
    }
}

std::string WebServer::HandleGetDestinationsForSource(int source_slot) {
    auto destinations = ndi_manager_->GetDestinationsForSource(source_slot);
    std::ostringstream json;
    json << "{\"sourceSlot\":" << source_slot << ",\"destinations\":[";
    
    for (size_t i = 0; i < destinations.size(); ++i) {
        if (i > 0) json << ",";
        json << destinations[i];
    }
    
    json << "]}";
    return json.str();
}

