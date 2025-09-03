cmake_minimum_required(VERSION 3.20)
project(NDIWebRouter)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find required packages
find_package(Threads REQUIRED)

# SQLite3 no longer needed - authentication removed

# Find OpenSSL (optional for Windows build)
if(NOT WIN32)
    find_package(OpenSSL REQUIRED)
endif()

# Platform detection
if(WIN32)
    set(NDI_PLATFORM "Win")
    set(NDI_ARCH "x64")
    set(NDI_LIB_NAME "Processing.NDI.Lib.x64.lib")
    set(NDI_DLL_NAME "Processing.NDI.Lib.x64.dll")
elseif(UNIX AND NOT APPLE)
    set(NDI_PLATFORM "Linux")
    # Detect architecture
    execute_process(COMMAND uname -m OUTPUT_VARIABLE ARCH OUTPUT_STRIP_TRAILING_WHITESPACE)
    if(ARCH MATCHES "x86_64")
        set(NDI_ARCH "x64")
    elseif(ARCH MATCHES "aarch64")
        set(NDI_ARCH "arm64")
    else()
        message(FATAL_ERROR "Unsupported architecture: ${ARCH}")
    endif()
    set(NDI_LIB_NAME "libndi.so")
elseif(APPLE)
    set(NDI_PLATFORM "macOS")
    set(NDI_ARCH "universal")
    set(NDI_LIB_NAME "libndi.dylib")
else()
    message(FATAL_ERROR "Unsupported platform")
endif()

message(STATUS "Building for ${NDI_PLATFORM} ${NDI_ARCH}")

# Include directories
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/backend/include)

# Platform-specific NDI SDK paths
if(WIN32)
    include_directories(${CMAKE_CURRENT_SOURCE_DIR}/backend/ndi_sdk/include)
    set(NDI_LIB_PATH ${CMAKE_CURRENT_SOURCE_DIR}/backend/ndi_sdk/lib/${NDI_ARCH}/${NDI_LIB_NAME})
    set(NDI_DLL_PATH ${CMAKE_CURRENT_SOURCE_DIR}/backend/ndi_sdk/bin/${NDI_ARCH}/${NDI_DLL_NAME})
else()
    # On Linux/macOS, assume NDI SDK is installed system-wide or provide path
    find_path(NDI_INCLUDE_DIR Processing.NDI.Lib.h
        PATHS
        /usr/local/include
        /usr/include
        /opt/ndi/include
        ${CMAKE_CURRENT_SOURCE_DIR}/ndi_sdk/include
    )
    
    find_library(NDI_LIBRARY
        NAMES ndi Processing.NDI.Lib
        PATHS
        /usr/local/lib
        /usr/lib
        /usr/lib/x86_64-linux-gnu
        /usr/lib/aarch64-linux-gnu
        /opt/ndi/lib
        ${CMAKE_CURRENT_SOURCE_DIR}/ndi_sdk/lib/${NDI_ARCH}
    )
    
    if(NOT NDI_INCLUDE_DIR OR NOT NDI_LIBRARY)
        message(FATAL_ERROR "NDI SDK not found. Please install NDI SDK or set NDI paths manually.")
    endif()
    
    include_directories(${NDI_INCLUDE_DIR})
    message(STATUS "Found NDI SDK at: ${NDI_INCLUDE_DIR}")
    message(STATUS "Found NDI Library at: ${NDI_LIBRARY}")
endif()

# Add executable
add_executable(ndi_router_v2
    backend/src/main.cpp
    backend/src/ndi_manager.cpp
    backend/src/web_server.cpp
)

# Platform-specific linking
if(WIN32)
    target_link_libraries(ndi_router_v2
        Threads::Threads
        ${NDI_LIB_PATH}
        ws2_32
    )
    
    # Copy NDI runtime libraries
    add_custom_command(TARGET ndi_router_v2 POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${NDI_DLL_PATH}
        $<TARGET_FILE_DIR:ndi_router_v2>
    )
else()
    target_link_libraries(ndi_router_v2
        Threads::Threads
        ${NDI_LIBRARY}
        dl
        OpenSSL::SSL
        OpenSSL::Crypto
    )
endif()

# Install target
install(TARGETS ndi_router_v2
    RUNTIME DESTINATION bin
)

# Install frontend files
install(DIRECTORY frontend/dist/
    DESTINATION share/ndi-web-router/frontend
    OPTIONAL
)