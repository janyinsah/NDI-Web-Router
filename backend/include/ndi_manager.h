#pragma once

#include <vector>
#include <string>
#include <memory>
#include <functional>
#include <thread>
#include <atomic>
#include <map>
#include <Processing.NDI.Lib.h>

struct NDISource {
    std::string name;
    std::string url;
    bool is_connected;
    std::string group_name;
};

struct MatrixSourceSlot {
    int slot_number;
    std::string assigned_ndi_source;  // Which NDI source is assigned to this slot
    std::string display_name;         // User-friendly name for this slot
    bool is_assigned;
};

struct MatrixDestination {
    int slot_number;
    std::string name;
    std::string description;
    bool is_enabled;
    int current_source_slot;          // Which source slot is routed to this destination (0 = none)
    NDIlib_send_instance_t ndi_sender;
};

struct MatrixRoute {
    std::string id;
    int source_slot;
    int destination_slot;
    bool is_active;
};

class NDIManager {
public:
    NDIManager();
    ~NDIManager();

    bool Initialize();
    void Shutdown();
    
    std::vector<NDISource> DiscoverSources();
    std::vector<NDISource> DiscoverStudioMonitors();
    
    // Matrix Source Slots Management
    std::vector<MatrixSourceSlot> GetSourceSlots();
    bool AssignSourceToSlot(int slot_number, const std::string& ndi_source_name, const std::string& display_name);
    bool UnassignSourceSlot(int slot_number);
    
    // Matrix Destinations Management
    std::vector<MatrixDestination> GetMatrixDestinations();
    bool CreateMatrixDestination(const std::string& name, const std::string& description);
    bool RemoveMatrixDestination(int slot_number);
    
    // Matrix Routing
    bool CreateMatrixRoute(int source_slot, int destination_slot);
    bool RemoveMatrixRoute(int source_slot, int destination_slot);
    bool UnassignDestination(int destination_slot);
    std::vector<MatrixRoute> GetMatrixRoutes();
    
    // Bulk Routing Operations
    bool CreateMultipleRoutes(int source_slot, const std::vector<int>& destination_slots);
    bool RemoveAllRoutesFromSource(int source_slot);
    std::vector<int> GetDestinationsForSource(int source_slot);
    
    // Initialize default matrix (4 destinations, 16 source slots)
    void InitializeDefaultMatrix();
    
    void SetSourceUpdateCallback(std::function<void(const std::vector<NDISource>&)> callback);
    
    // Preview Monitor
    bool SetPreviewSource(const std::string& source_name);
    std::string GetPreviewSource();
    std::vector<uint8_t> CapturePreviewFrame();  // Returns JPEG data
    void ClearPreviewSource();

private:
    NDIlib_find_instance_t ndi_find_;
    std::vector<std::unique_ptr<NDIlib_recv_instance_t>> receivers_;
    std::vector<std::unique_ptr<NDIlib_send_instance_t>> senders_;
    std::vector<MatrixSourceSlot> matrix_source_slots_;
    std::vector<MatrixDestination> matrix_destinations_;
    std::vector<MatrixRoute> matrix_routes_;
    std::function<void(const std::vector<NDISource>&)> source_update_callback_;
    
    // Map of source name to receiver for persistent connections
    std::map<std::string, NDIlib_recv_instance_t> route_receivers_;
    
    // Preview monitor
    NDIlib_recv_instance_t preview_receiver_;
    std::string current_preview_source_;
    
    std::string GenerateDestinationId();
    MatrixDestination* FindMatrixDestination(int slot_number);
    MatrixSourceSlot* FindMatrixSourceSlot(int slot_number);
    NDIlib_recv_instance_t GetOrCreateReceiver(const std::string& source_name);
    void CleanupUnusedReceivers();
    void SendTestFramesToAllDestinations(); // Send test frames to make outputs visible
    
    void SourceDiscoveryThread();
    void ProcessRoutes();  // Process all active routes
    std::unique_ptr<std::thread> routing_thread_;
    std::atomic<bool> should_stop_routing_;
    std::atomic<bool> is_updating_routes_;
};