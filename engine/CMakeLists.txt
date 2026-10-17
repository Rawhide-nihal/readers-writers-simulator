cmake_minimum_required(VERSION 3.16)
project(syncdb_lab_engine C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

add_compile_options(-Wall -Wextra -Wpedantic -D_GNU_SOURCE)

# Find packages
find_package(Threads REQUIRED)
find_package(PkgConfig REQUIRED)
pkg_check_modules(SQLITE3 REQUIRED sqlite3)
pkg_check_modules(CJSON REQUIRED libcjson)

include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${SQLITE3_INCLUDE_DIRS}
    ${CJSON_INCLUDE_DIRS}
)

set(ENGINE_SOURCES
    src/metrics.c
    src/database.c
    src/protocol.c
    src/reader_preference.c
    src/writer_preference.c
    src/fair_scheduler.c
    src/scheduler.c
    src/worker.c
    src/engine.c
)

# Engine Executable
add_executable(syncdb_engine src/main.c ${ENGINE_SOURCES})
target_link_libraries(syncdb_engine PRIVATE
    Threads::Threads
    ${SQLITE3_LIBRARIES}
    ${CJSON_LIBRARIES}
    m
)

# Engine Unit & Correctness Tests
add_executable(test_correctness
    ${CMAKE_CURRENT_SOURCE_DIR}/../tests/engine/test_correctness.c
    ${ENGINE_SOURCES}
)
target_link_libraries(test_correctness PRIVATE
    Threads::Threads
    ${SQLITE3_LIBRARIES}
    ${CJSON_LIBRARIES}
    m
)
target_include_directories(test_correctness PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/include)
