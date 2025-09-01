cmake_minimum_required(VERSION 3.20)
project(NDIWebRouter)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find required packages
find_package(Threads REQUIRED)

# Include directories
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/backend/include)
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/backend/ndi_sdk/include)

# Add executable
add_executable(ndi_router_v2
    backend/src/main.cpp
    backend/src/ndi_manager.cpp
    backend/src/web_server.cpp
)

# Link libraries
target_link_libraries(ndi_router_v2
    Threads::Threads
    ${CMAKE_CURRENT_SOURCE_DIR}/backend/ndi_sdk/lib/x64/Processing.NDI.Lib.x64.lib
)

# Copy NDI runtime libraries
if(WIN32)
    add_custom_command(TARGET ndi_router_v2 POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/backend/ndi_sdk/bin/x64/Processing.NDI.Lib.x64.dll"
        $<TARGET_FILE_DIR:ndi_router_v2>)
endif()