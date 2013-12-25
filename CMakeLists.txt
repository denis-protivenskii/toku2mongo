if (APPLE)
  cmake_minimum_required(VERSION 2.8.12 FATAL_ERROR)
  set(CMAKE_MACOSX_RPATH TRUE)
else ()
  cmake_minimum_required(VERSION 2.8.9 FATAL_ERROR)
endif ()

project(tokumx)

option(USE_SSL "Enable SSL" OFF)
set(JS_ENGINE v8 CACHE STRING "Javascript engine (sm or v8)")
option(USE_SYSTEM_V8 "use system version of v8 library" OFF)
option(USE_SYSTEM_PCRE "use system version of pcre library" OFF)
option(USE_SYSTEM_BOOST "use system version of boost libraries" OFF)
option(USE_SASL_CLIENT "Support SASL authentication in the client library" OFF)

if (NOT (JS_ENGINE STREQUAL v8 OR
         JS_ENGINE STREQUAL sm))
  message(FATAL_ERROR "invalid JS_ENGINE ${JS_ENGINE}, options are sm or v8")
endif ()

set(CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")

set_property(DIRECTORY APPEND PROPERTY COMPILE_DEFINITIONS
  MONGO_EXPOSE_MACROS
  SUPPORT_UTF8
  )

find_program(PYTHON2 NAMES python2.7 python2 python2.6 python)
if (PYTHON2 MATCHES NOTFOUND)
  message(SEND_ERROR "cannot find python 2")
endif ()

find_package(Threads)

include(CheckCXXCompilerFlag)
macro(set_cxxflags_if_supported)
  foreach(flag ${ARGN})
    check_cxx_compiler_flag(${flag} HAVE_CXX_${flag})
    if (HAVE_CXX_${flag})
      set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${flag}")
    endif ()
  endforeach(flag)
endmacro(set_cxxflags_if_supported)

set(CMAKE_C_FLAGS "-fPIC -fno-strict-aliasing -ggdb -Wall -Wsign-compare -Wno-unknown-pragmas -Winvalid-pch -Werror -pipe")
set(CMAKE_CXX_FLAGS "-fPIC -fno-strict-aliasing -ggdb")
set_cxxflags_if_supported(
  -Wall
  -Wsign-compare
  -Wno-unknown-pragmas
  -Winvalid-pch
  -Werror
  -pipe
  -Wnon-virtual-dtor
  -Woverloaded-virtual
  -Wno-unused-local-typedefs
  )
if (CMAKE_CXX_COMPILER_ID STREQUAL GNU)
  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fno-builtin-memcmp")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fno-builtin-memcmp")
endif ()
set_property(DIRECTORY APPEND PROPERTY COMPILE_DEFINITIONS
  _FILE_OFFSET_BITS=64
  )
set(CMAKE_C_FLAGS_DEBUG "-O0 -fstack-protector")
set(CMAKE_CXX_FLAGS_DEBUG "-O0 -fstack-protector")
set(CMAKE_C_FLAGS_RELWITHDEBINFO "-O2 -g3")
set(CMAKE_CXX_FLAGS_RELWITHDEBINFO "-O2 -g3")
set(CMAKE_C_FLAGS_RELEASE "-O3")
set(CMAKE_CXX_FLAGS_RELEASE "-O3")

set_property(DIRECTORY APPEND PROPERTY COMPILE_DEFINITIONS_DEBUG _DEBUG)

if (USE_SSL)
  set_property(DIRECTORY APPEND PROPERTY COMPILE_DEFINITIONS MONGO_SSL)
  find_package(SSL REQUIRED)
endif ()

include(CheckIncludeFiles)
check_include_files(unistd.h MONGO_HAVE_HEADER_UNISTD_H)
if (MONGO_HAVE_HEADER_UNISTD_H)
  set_property(DIRECTORY APPEND PROPERTY COMPILE_DEFINITIONS MONGO_HAVE_HEADER_UNISTD_H)
endif ()

if (USE_SASL_CLIENT)
  find_package(SASL REQUIRED)
endif ()

include(CheckSymbolExists)
check_symbol_exists(clock_gettime time.h HAVE_CLOCK_GETTIME)
if (HAVE_CLOCK_GETTIME)
  find_package(RT REQUIRED)
endif ()

check_include_files(execinfo.h MONGO_HAVE_EXECINFO_H)
if (MONGO_HAVE_EXECINFO_H)
  check_symbol_exists(backtrace execinfo.h MONGO_HAVE_BACKTRACE)
  check_symbol_exists(backtrace_symbols execinfo.h MONGO_HAVE_BACKTRACE_SYMBOLS)
  check_symbol_exists(backtrace_symbols_fd execinfo.h MONGO_HAVE_BACKTRACE_SYMBOLS_FD)
  if (MONGO_HAVE_BACKTRACE AND
      MONGO_HAVE_BACKTRACE_SYMBOLS AND
      MONGO_HAVE_BACKTRACE_SYMBOLS_FD)
    set_property(DIRECTORY APPEND PROPERTY COMPILE_DEFINITIONS MONGO_HAVE_EXECINFO_BACKTRACE)
  endif ()
endif ()

find_package(PCAP)
if (PCAP_FOUND)
  set_property(DIRECTORY APPEND PROPERTY COMPILE_DEFINITIONS _HAVEPCAP)
endif ()

option(BUILD_TESTING "build tests" ON)
if (BUILD_TESTING)
  include(CTest)
endif ()

if (APPLE)
  set(CPACK_SYSTEM_NAME osx)
elseif (CMAKE_SYSTEM_NAME STREQUAL Linux)
  set(CPACK_SYSTEM_NAME linux)
elseif (CMAKE_SYSTEM_NAME STREQUAL FreeBSD)
  set(CPACK_SYSTEM_NAME freebsd)
elseif (CMAKE_SYSTEM_NAME STREQUAL SunOS)
  set(CPACK_SYSTEM_NAME solaris)
endif ()
if (CMAKE_SIZEOF_VOID_P EQUAL 8)
  set(CPACK_SYSTEM_NAME "${CPACK_SYSTEM_NAME}-x86_64")
else ()
  message(SEND_ERROR "tokumx isn't supported on 32-bit")
  set(CPACK_SYSTEM_NAME "${CPACK_SYSTEM_NAME}-x86")
endif ()
if (CMAKE_BUILD_TYPE STREQUAL Debug)
  set(CPACK_SYSTEM_NAME "${CPACK_SYSTEM_NAME}-debug")
endif ()

find_program(OBJCOPY objcopy)
function (install_executables component)
  foreach (target ${ARGN})
    if (NOT OBJCOPY MATCHES NOTFOUND)
      add_custom_command(TARGET ${target} POST_BUILD
        COMMAND ${OBJCOPY} --only-keep-debug
                $<TARGET_FILE:${target}> $<TARGET_FILE_DIR:${target}>/${target}.dbg
        COMMAND ${OBJCOPY} --strip-debug
                $<TARGET_FILE:${target}>
        COMMAND ${OBJCOPY} --add-gnu-debuglink=${target}.dbg
                $<TARGET_FILE:${target}>
        )
      install(FILES
        ${CMAKE_CURRENT_BINARY_DIR}/${target}.dbg
        COMPONENT tokumx_debuginfo
        DESTINATION bin
        )
    endif ()
    install(TARGETS
      ${target}
      COMPONENT ${component}
      DESTINATION bin
      )
  endforeach ()
endfunction ()

function(target_link_whole_libraries target)
  if (APPLE)
    foreach (lib ${ARGN})
      target_link_libraries(${target} -Wl,-force_load ${lib})
    endforeach ()
  else ()
    target_link_libraries(${target} -Wl,-whole-archive ${ARGN} -Wl,-no-whole-archive)
  endif ()
endfunction()

if (CMAKE_SIZEOF_VOID_P EQUAL 8)
  set(INSTALL_LIBDIR lib64 CACHE STRING "where we should install libs")
else ()
  set(INSTALL_LIBDIR lib CACHE STRING "where we should install libs")
endif ()
if (APPLE)
  set(CMAKE_INSTALL_RPATH
    "@loader_path/../${INSTALL_LIBDIR}"
    "@loader_path/../${INSTALL_LIBDIR}/plugins"
    )
elseif (UNIX)
  set(CMAKE_INSTALL_RPATH
    "\$ORIGIN/../${INSTALL_LIBDIR}/"
    "\$\$ORIGIN/../${INSTALL_LIBDIR}/"
    "\$ORIGIN/../${INSTALL_LIBDIR}/plugins/"
    "\$\$ORIGIN/../${INSTALL_LIBDIR}/plugins/"
    )
endif ()

add_subdirectory(src/third_party)
include_directories(
  ${Boost_INCLUDE_DIRS}
  ${PCRE_INCLUDE_DIRS}
  ${TokuKV_INCLUDE_DIRS}
  ${TokuBackup_INCLUDE_DIRS}
  )
if (JS_ENGINE STREQUAL v8)
  include_directories(${V8_INCLUDE_DIRS})
endif ()
add_subdirectory(src/mongo)

add_subdirectory(distsrc)

install(PROGRAMS scripts/tokumxstat.py
  COMPONENT tokumx_tools
  DESTINATION scripts
  )

install(PROGRAMS buildscripts/make_archive.py
  COMPONENT tokumx_client_misc
  DESTINATION buildscripts
  )
install(FILES src/SConscript.client
  COMPONENT tokumx_client_misc
  DESTINATION src
  )

file(READ src/mongo/util/version.cpp version_cpp_contents)
string(REGEX MATCH "const char tokumxVersionString\\[\\] = \"(([0-9]+)\\.([0-9]+)\\.([0-9]+)([^\"]*))\"\\;" unused "${version_cpp_contents}")
set(CPACK_PACKAGE_VERSION ${CMAKE_MATCH_1})
set(CPACK_PACKAGE_VERSION_MAJOR ${CMAKE_MATCH_2})
set(CPACK_PACKAGE_VERSION_MINOR ${CMAKE_MATCH_3})
set(CPACK_PACKAGE_VERSION_PATCH ${CMAKE_MATCH_4})

set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "a high-performance mongodb server with fractal tree storage")
set(CPACK_PACKAGE_VENDOR "Tokutek, Inc.")
set(CPACK_PACKAGE_INSTALL_DIRECTORY "tokumx-${CPACK_PACKAGE_VERSION}")
set(CPACK_ARCHIVE_COMPONENT_INSTALL TRUE)
set(CPACK_COMPONENT_INCLUDE_TOPLEVEL_DIRECTORY TRUE)
set(CPACK_GENERATOR TGZ)

set(CPACK_COMPONENT_TOKUMX_DEBUGINFO_GROUP debuginfo)
set(CPACK_COMPONENT_TOKUMX_SERVER_GROUP server)
set(CPACK_COMPONENT_TOKUMX_MISC_GROUP server)
set(CPACK_COMPONENT_TOKUMX_TOOLS_GROUP server)
set(CPACK_COMPONENT_TOKUMX_LIBS_EXTRA_GROUP server)
set(CPACK_COMPONENT_TOKUMX_PLUGINS_GROUP server)
set(CPACK_COMPONENT_TOKUMX_CLIENT_HEADERS_GROUP client)
set(CPACK_COMPONENT_TOKUMX_CLIENT_SOURCES_GROUP client)
set(CPACK_COMPONENT_TOKUMX_CLIENT_MISC_GROUP client)
set(CPACK_COMPONENT_TOKUKV_LIBS_SHARED_GROUP server)
set(CPACK_COMPONENT_TOKUBACKUP_LIBS_SHARED_GROUP server)
set(CPACK_COMPONENTS_ALL
  tokumx_server
  tokumx_misc
  tokumx_tools
  tokumx_libs_extra
  tokumx_plugins
  tokumx_client_headers
  tokumx_client_sources
  tokumx_client_misc
  tokukv_libs_shared
  tokubackup_libs_shared
  tokumx_debuginfo
  )

include(CPack)