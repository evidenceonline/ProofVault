# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

This is a Scala SBT project with multiple modules. Common commands:

- `sbt compile` - Compile all modules
- `sbt test` - Run tests (uses Weaver test framework)
- `sbt "project <module>" run` - Run specific module (e.g., `sbt "project dataL1" run`)
- `sbt assembly` - Create fat JARs for all modules
- `sbt scalafmt` - Format code using Scalafmt
- `sbt scalafix` - Run Scalafix linting/refactoring
- `sbt dependencyUpdates` - Check for dependency updates

Individual modules can be built/run separately:
- `sbt "project sharedData" run` - Run shared_data module
- `sbt "project currencyL0" run` - Run L0 node
- `sbt "project currencyL1" run` - Run L1 node  
- `sbt "project dataL1" run` - Run data L1 node

## Architecture

This is a **Tessellation blockchain metagraph** project with a layered architecture:

### Modules Structure
- **shared_data** (`modules/shared_data/`) - Common data models and utilities shared across layers
- **l0** (`modules/l0/`) - Currency L0 node (base layer, generates genesis files)
- **l1** (`modules/l1/`) - Currency L1 node (transaction processing layer)
- **data_l1** (`modules/data_l1/`) - Data application L1 node (custom data processing)

### Key Components
- **TextUpdate** (`shared_data/model/TextUpdate.scala`) - Core data model representing updates with `id` and `hash` fields
- **Repo** (`data_l1/Repo.scala`) - In-memory repository for storing TextUpdate data
- **Data Application Service** (`data_l1/Main.scala:45-127`) - Implements Tessellation's DataApplicationL1Service pattern

### Tessellation Integration
The project extends Tessellation framework apps:
- Uses `CurrencyL0App` and `CurrencyL1App` base classes
- Implements empty state pattern with `EmptyOnChainState` and `EmptyCalculatedState`
- Data application follows NFT-like pattern with minimal validation
- Cluster ID: `517c3a05-9219-471b-a54c-21b7d72f4ae5`

### API Endpoints
The data_l1 module exposes:
- `GET /data-application/text/{id}` - Retrieve TextUpdate by ID

## Dependencies

Core dependencies:
- **Tessellation** v2.8.1 - Blockchain framework (tessellation-currency, tessellation-node-shared)
- **Cats Effect** 3.4.2 - Functional effects
- **Circe** 0.14.3 - JSON handling
- **Monocle** 3.2.0 - Optics library
- **Weaver** 0.8.1 - Testing framework
- **PureConfig** 0.17.4 - Configuration management

## Project Configuration

- Scala version: 2.13.10
- SBT version: 1.9.8
- Organization: `io.proofvault`
- Version: 0.2.0-SNAPSHOT
- Main packages under `io.proofvault.*`