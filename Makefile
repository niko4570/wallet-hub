SHELL := /bin/bash
.DEFAULT_GOAL := help

ifneq (,$(wildcard .env.local))
include .env.local
export
endif

EXPO_PUBLIC_API_URL ?= http://localhost:3000
ADB_PORT ?= 3000

.PHONY: help install dev-api dev-mobile dev-all build-api build-contracts lint test-api android adb-reverse

help:
	@echo "WalletHub shortcuts:"
	@echo "  make install        # npm install (root workspaces)"
	@echo "  make dev-api        # start Nest API (watch mode)"
	@echo "  make dev-mobile     # start Expo dev server (uses EXPO_PUBLIC_API_URL)"
	@echo "  make android        # build & install debug apk via USB"
	@echo "  make build-api      # compile Nest API"
	@echo "  make build-contracts# compile shared contracts"
	@echo "  make lint           # run backend lint"
	@echo "  make test-api       # run backend tests"
	@echo "  make dev-all        # concurrently run API + Expo"

install:
	npm install

dev-api:
	npm run dev:api

dev-mobile:
	EXPO_PUBLIC_API_URL=$(EXPO_PUBLIC_API_URL) npm run start --workspace apps/mobile

android: adb-reverse
	cd apps/mobile && EXPO_PUBLIC_API_URL=$(EXPO_PUBLIC_API_URL) npx --yes expo run:android

adb-reverse:
	@echo ">> Mapping device tcp:$(ADB_PORT) -> host tcp:$(ADB_PORT) via adb"
	@adb reverse tcp:$(ADB_PORT) tcp:$(ADB_PORT) >/dev/null 2>&1 || true

dev-all:
	EXPO_PUBLIC_API_URL=$(EXPO_PUBLIC_API_URL) npx concurrently "npm run dev:api" "npm run start --workspace apps/mobile"

build-api:
	npm run build:api

build-contracts:
	npm run build:contracts

lint:
	npm run lint

test-api:
	npm run test --workspace apps/api -- --runInBand
