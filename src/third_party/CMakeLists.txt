add_subdirectory(murmurhash3)

if (USE_SYSTEM_PCRE)
  find_package(PCRE REQUIRED)
else ()
  add_subdirectory(pcre-8.30)
endif ()

if (USE_SYSTEM_BOOST)
  find_package(Boost 1.49 REQUIRED
    COMPONENTS system thread filesystem program_options
    )
else ()
  set_property(DIRECTORY PROPERTY COMPILE_DEFINITIONS BOOST_ALL_NO_LIB)
  add_subdirectory(boost)
endif ()
include_directories(${Boost_INCLUDE_DIRS})

if (JS_ENGINE STREQUAL sm)
  message(SEND_ERROR "haven't configured spidermonkey yet, use v8")
elseif (JS_ENGINE STREQUAL v8)
  if (USE_SYSTEM_V8)
    find_package(V8 REQUIRED)
  else ()
    add_subdirectory(v8)
  endif ()
else ()
  message(SEND_ERROR "no js engine chosen (please set JS_ENGINE=v8)")
endif ()

set(HOT_BACKUP_LIBNAME HotBackup CACHE STRING "TokuBackup library name" FORCE)
add_subdirectory(backup)
set(TokuBackup_FOUND TRUE CACHE BOOL "TokuBackup found" FORCE)
set(TokuBackup_INCLUDE_DIRS "${CMAKE_CURRENT_SOURCE_DIR}/backup" CACHE STRING "TokuBackup include dirs" FORCE)
set(TokuBackup_LIBRARIES HotBackup CACHE STRING "TokuBackup libraries" FORCE)

set(USE_CTAGS OFF)
set(USE_CSCOPE OFF)
set(USE_ETAGS OFF)
set(USE_GTAGS OFF)
add_subdirectory(ft-index)

install(
  FILES ft-index/README-TOKUDB
  RENAME README-TOKUKV
  DESTINATION .
  COMPONENT tokumx_misc
  )

set(TokuKV_FOUND TRUE CACHE BOOL "TokuKV found" FORCE)
set(TokuKV_INCLUDE_DIRS
  "${CMAKE_CURRENT_BINARY_DIR}/${CMAKE_CFG_INTDIR}/ft-index/buildheader"
  "${CMAKE_CURRENT_BINARY_DIR}/${CMAKE_CFG_INTDIR}/ft-index/toku_include"
  "${CMAKE_CURRENT_SOURCE_DIR}/ft-index/include"
  "${CMAKE_CURRENT_SOURCE_DIR}/ft-index/portability"
  "${CMAKE_CURRENT_SOURCE_DIR}/ft-index/toku_include"
  "${CMAKE_CURRENT_SOURCE_DIR}/ft-index/util"
  CACHE STRING "TokuKV include dirs" FORCE)
set(TokuKV_LIBRARIES
  tokuportability
  tokufractaltree
  CACHE STRING "TokuKV libraries" FORCE)

mark_as_advanced(
  TokuBackup_FOUND
  TokuBackup_INCLUDE_DIRS
  TokuBackup_LIBRARIES
  TokuKV_FOUND
  TokuKV_INCLUDE_DIRS
  TokuKV_LIBRARIES
  )