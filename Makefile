SHELL := /bin/bash
.DEFAULT_GOAL := help

ifneq (,$(wildcard .env.local))
include .env.local
export
endif

EXPO_PUBLIC_API_URL ?= http://localhost:3000
ADB_PORT ?= 3000
ENV_EXPORT := EXPO_PUBLIC_API_URL=$(EXPO_PUBLIC_API_URL)

.PHONY: help install dev-api dev-mobile dev-all build build-api build-contracts lint test-api android adb-reverse web clean-mobile ios

help:
	@echo "WalletHub shortcuts:"
	@echo "  make install        # npm install (root workspaces)"
	@echo "  make dev-api        # start Nest API (watch mode)"
	@echo "  make dev-mobile     # start Expo dev server (uses EXPO_PUBLIC_API_URL)"
	@echo "  make android        # build & install debug apk via USB"
	@echo "  make ios            # build & run on iOS simulator"
	@echo "  make build          # compile shared contracts + API"
	@echo "  make build-api      # compile Nest API only"
	@echo "  make build-contracts# compile shared contracts only"
	@echo "  make lint           # run backend lint"
	@echo "  make test-api       # run backend tests"
	@echo "  make dev-all        # concurrently run API + Expo"
	@echo "  make web            # run Expo web preview"
	@echo "  make clean-mobile   # clean mobile build cache"

install:
	npm install

# Start API development server
dev-api:
	npm run dev:api

# Start mobile development server
dev-mobile:
	$(ENV_EXPORT) npm run dev:mobile

# Build and install Android debug APK
android: adb-reverse
	cd apps/mobile && $(ENV_EXPORT) npx --yes expo run:android

# Build and run on iOS simulator
ios:
	cd apps/mobile && $(ENV_EXPORT) npx --yes expo run:ios

# Run Expo web preview
web:
	$(ENV_EXPORT) npm run web

# Clean mobile build cache
clean-mobile:
	cd apps/mobile && rm -rf .expo node_modules/.expo android/build ios/build

# Reverse adb port for device debugging
adb-reverse:
	@echo ">> Mapping device tcp:$(ADB_PORT) -> host tcp:$(ADB_PORT) via adb"
	@adb reverse tcp:$(ADB_PORT) tcp:$(ADB_PORT) >/dev/null 2>&1 || true

# Run both API and mobile dev servers concurrently
dev-all:
	$(ENV_EXPORT) npx concurrently --kill-others-on-fail --names "api,mobile" \
		"npm run dev:api" \
		"npm run dev:mobile"

# Build shared contracts and API
build:
	npm run build

# Build API only
build-api:
	npm run build:api

# Build shared contracts only
build-contracts:
	npm run build:contracts

# Run backend linting
lint:
	npm run lint

# Run backend tests
test-api:
	npm run test --workspace apps/api -- --runInBand
