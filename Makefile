SHELL := /bin/bash
.DEFAULT_GOAL := help

ifneq (,$(wildcard .env.local))
include .env.local
export
endif

EXPO_PUBLIC_API_URL ?= http://localhost:3000
ADB_PORT ?= 3000
ENV_EXPORT := EXPO_PUBLIC_API_URL=$(EXPO_PUBLIC_API_URL)

.PHONY: help install dev-api dev-mobile dev-all build build-api build-contracts lint test-api android adb-reverse web

help:
	@echo "WalletHub shortcuts:"
	@echo "  make install        # npm install (root workspaces)"
	@echo "  make dev-api        # start Nest API (watch mode)"
	@echo "  make dev-mobile     # start Expo dev server (uses EXPO_PUBLIC_API_URL)"
	@echo "  make android        # build & install debug apk via USB"
	@echo "  make build          # compile shared contracts + API"
	@echo "  make build-api      # compile Nest API only"
	@echo "  make build-contracts# compile shared contracts only"
	@echo "  make lint           # run backend lint"
	@echo "  make test-api       # run backend tests"
	@echo "  make dev-all        # concurrently run API + Expo"
	@echo "  make web            # run Expo web preview"

install:
	npm install

dev-api:
	npm run dev:api

dev-mobile:
	$(ENV_EXPORT) npm run dev:mobile

android: adb-reverse
	cd apps/mobile && $(ENV_EXPORT) npx --yes expo run:android

web:
	$(ENV_EXPORT) npm run web

adb-reverse:
	@echo ">> Mapping device tcp:$(ADB_PORT) -> host tcp:$(ADB_PORT) via adb"
	@adb reverse tcp:$(ADB_PORT) tcp:$(ADB_PORT) >/dev/null 2>&1 || true

dev-all:
	$(ENV_EXPORT) npx concurrently --kill-others-on-fail --names "api,mobile" \
		"npm run dev:api" \
		"npm run dev:mobile"

build:
	npm run build

build-api:
	npm run build:api

build-contracts:
	npm run build:contracts

lint:
	npm run lint

test-api:
	npm run test --workspace apps/api -- --runInBand
