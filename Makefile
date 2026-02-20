SHELL := /bin/bash
.DEFAULT_GOAL := help

# 使用 dotenv 加载 .env 文件中的环境变量
ifneq (,$(wildcard .env))
include .env
export
endif

EXPO_PUBLIC_API_URL ?= http://localhost:3000
ADB_PORT ?= 3000
ENV_EXPORT := EXPO_PUBLIC_API_URL=$(EXPO_PUBLIC_API_URL) \
	EXPO_PUBLIC_HELIUS_API_KEY=$(EXPO_PUBLIC_HELIUS_API_KEY) \
	EXPO_PUBLIC_COINGECKO_API_KEY=$(EXPO_PUBLIC_COINGECKO_API_KEY) \
	EXPO_PUBLIC_HELIUS_API_BASE=$(EXPO_PUBLIC_HELIUS_API_BASE)

.PHONY: help install dev-api dev-mobile dev-app dev-all build build-api build-contracts lint test-api android adb-reverse web clean-mobile clean-app ios check-env-mobile print-env-mobile export-env setup eas-build-dev eas-build-preview eas-build-prod eas-submit typecheck-mobile

help:
	@echo "WalletHub shortcuts:"
	@echo "  make install        # pnpm install (root workspaces)"
	@echo "  make setup          # setup project with dependencies"
	@echo "  make dev-api        # start Nest API (watch mode, optional)"
	@echo "  make dev-mobile     # start Expo dev server"
	@echo "  make dev-app        # alias for dev-mobile"
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
	@echo "  make clean-app      # alias for clean-mobile"
	@echo "  make check-env-mobile # warn if mobile env vars are missing"
	@echo "  make print-env-mobile # print mobile env vars"
	@echo "  make export-env     # export environment variables"
	@echo "  make typecheck-mobile # run mobile TypeScript check"
	@echo "  make eas-build-dev  # build development APK with EAS"
	@echo "  make eas-build-preview # build preview APK with EAS"
	@echo "  make eas-build-prod # build production AAB with EAS"
	@echo "  make eas-submit     # submit to Google Play"

install:
	pnpm install

# Setup project with dependencies
setup:
	pnpm install
	pnpm run build:contracts

# Start API development server
dev-api:
	pnpm run dev:api

# Start mobile development server
dev-mobile: check-env-mobile
	$(ENV_EXPORT) pnpm run dev:mobile

dev-app: dev-mobile

# Build and install Android debug APK
android: adb-reverse
	cd apps/mobile && $(ENV_EXPORT) pnpm exec expo run:android

# Build and run on iOS simulator
ios:
	cd apps/mobile && $(ENV_EXPORT) pnpm exec expo run:ios

# Run Expo web preview
web:
	$(ENV_EXPORT) pnpm run web

# Clean mobile build cache
clean-mobile:
	cd apps/mobile && rm -rf .expo node_modules/.expo android/build ios/build

clean-app: clean-mobile

# Reverse adb port for device debugging
adb-reverse:
	@echo ">> Mapping device tcp:$(ADB_PORT) -> host tcp:$(ADB_PORT) via adb"
	@adb reverse tcp:$(ADB_PORT) tcp:$(ADB_PORT) >/dev/null 2>&1 || true

# Run both API and mobile dev servers concurrently
dev-all:
	$(ENV_EXPORT) pnpm exec concurrently --kill-others-on-fail --names "api,mobile" \
		"pnpm run dev:api" \
		"pnpm run dev:mobile"

# Build shared contracts and API
build:
	pnpm run build

# Build API only
build-api:
	pnpm run build:api

# Build shared contracts only
build-contracts:
	pnpm run build:contracts

# Run backend linting
lint:
	pnpm run lint

# Run backend tests
test-api:
	pnpm run test --workspace apps/api -- --runInBand

# Check mobile environment variables
check-env-mobile:
	@if [ -z "$(EXPO_PUBLIC_HELIUS_API_KEY)" ]; then \
		echo "Warning: EXPO_PUBLIC_HELIUS_API_KEY is not set (RPC will use demo/limited access)."; \
	fi
	@if [ -z "$(EXPO_PUBLIC_COINGECKO_API_KEY)" ]; then \
		echo "Warning: EXPO_PUBLIC_COINGECKO_API_KEY is not set (price lookups may be rate-limited)."; \
	fi

# Print mobile environment variables
print-env-mobile:
	@echo "EXPO_PUBLIC_API_URL=$(EXPO_PUBLIC_API_URL)"
	@echo "EXPO_PUBLIC_HELIUS_API_KEY=$(EXPO_PUBLIC_HELIUS_API_KEY)"
	@echo "EXPO_PUBLIC_COINGECKO_API_KEY=$(EXPO_PUBLIC_COINGECKO_API_KEY)"
	@echo "EXPO_PUBLIC_HELIUS_API_BASE=$(EXPO_PUBLIC_HELIUS_API_BASE)"

# Export environment variables
export-env:
	@echo "Exporting environment variables..."
	@echo "EXPO_PUBLIC_API_URL=$(EXPO_PUBLIC_API_URL)"
	@echo "EXPO_PUBLIC_HELIUS_API_KEY=$(EXPO_PUBLIC_HELIUS_API_KEY)"
	@echo "EXPO_PUBLIC_COINGECKO_API_KEY=$(EXPO_PUBLIC_COINGECKO_API_KEY)"
	@echo "EXPO_PUBLIC_HELIUS_API_BASE=$(EXPO_PUBLIC_HELIUS_API_BASE)"
	@echo "\nAdd these to your .env file if not already set."

# Type check mobile app
typecheck-mobile:
	pnpm exec tsc -p apps/mobile/tsconfig.json --noEmit

# EAS build commands
eas-build-dev:
	cd apps/mobile && eas build --profile development --platform android

eas-build-preview:
	cd apps/mobile && eas build --profile preview --platform android

eas-build-prod:
	cd apps/mobile && eas build --profile production --platform android

eas-submit:
	cd apps/mobile && eas submit --platform android --latest

