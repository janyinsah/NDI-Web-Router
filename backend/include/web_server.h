#pragma once

#include <string>
#include <functional>
#include <memory>
#include <thread>
#include "ndi_manager.h"

class WebServer {
public:
    WebServer(int port, std::shared_ptr<NDIManager> ndi_manager);
    ~WebServer();

    bool Start();
    void Stop();
    bool IsRunning() const { return is_running_; }

private:
    int port_;
    bool is_running_;
    std::shared_ptr<NDIManager> ndi_manager_;
    std::unique_ptr<std::thread> server_thread_;
    
    void ServerThreadFunction();
    void HandleRequest(int client_socket);
    
    std::string HandleGetSources();
    std::string HandleGetStudioMonitors();
    std::string HandleResetStudioMonitors();
    std::string HandleGetMatrixRoutes();
    std::string HandleGetMatrixSourceSlots();
    std::string HandleGetMatrixDestinations();
    std::string HandleAssignSourceToSlot(const std::string& request_body);
    std::string HandleUnassignSourceSlot(int slot_number);
    std::string HandleCreateMatrixDestination(const std::string& request_body);
    std::string HandleRemoveMatrixDestination(int slot_number);
    std::string HandleCreateMatrixRoute(const std::string& request_body);
    std::string HandleRemoveMatrixRoute(const std::string& request_body);
    std::string HandleUnassignDestination(int destination_slot);
    
    // Bulk routing operations
    std::string HandleCreateMultipleRoutes(const std::string& request_body);
    std::string HandleRemoveAllRoutesFromSource(int source_slot);
    std::string HandleGetDestinationsForSource(int source_slot);
    std::string HandleSetPreviewSource(const std::string& request_body);
    std::string HandleGetPreviewSource();
    std::string HandleGetPreviewFrame();
    std::string HandleClearPreviewSource();
    
    std::string CreateJSONResponse(const std::string& data, int status_code = 200);
    std::string CreateErrorResponse(const std::string& error, int status_code = 400);
};