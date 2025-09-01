#include <iostream>
#include <memory>
#include <signal.h>
#include <thread>
#include <chrono>
#include <cstdlib>
#include "ndi_manager.h"
#include "web_server.h"

std::shared_ptr<WebServer> g_web_server;

void SignalHandler(int signal) {
    std::cout << "Received signal " << signal << ", shutting down..." << std::endl;
    if (g_web_server) {
        g_web_server->Stop();
    }
    exit(0);
}

int main(int argc, char* argv[]) {
    signal(SIGINT, SignalHandler);
    signal(SIGTERM, SignalHandler);

    std::cout << "NDI Web Router starting..." << std::endl;

    auto ndi_manager = std::make_shared<NDIManager>();
    if (!ndi_manager->Initialize()) {
        std::cerr << "Failed to initialize NDI Manager" << std::endl;
        return 1;
    }

    int port = 8080;
    if (argc > 1) {
        port = std::atoi(argv[1]);
    }

    g_web_server = std::make_shared<WebServer>(port, ndi_manager);
    if (!g_web_server->Start()) {
        std::cerr << "Failed to start web server on port " << port << std::endl;
        return 1;
    }

    std::cout << "NDI Web Router running on port " << port << std::endl;
    std::cout << "Press Ctrl+C to stop" << std::endl;

    while (g_web_server->IsRunning()) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    ndi_manager->Shutdown();
    std::cout << "NDI Web Router stopped" << std::endl;
    return 0;
}