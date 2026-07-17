.PHONY: install build

install: build
	npm link

dev:
	npm run dev

build:
	npm install
	npm run build
