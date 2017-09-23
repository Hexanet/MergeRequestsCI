default: help
.DEFAULT_GOAL := help

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Install
	@npm install

.PHONY: build
build: ## Build the project
	@echo 'Building the project'
	@brunch b --production

.PHONY: serve
serve: build ## Run the server
	@node_modules/brunch/bin/brunch b --production
	@echo 'Starting web server on http://localhost:3000'
	@node_modules/serve/bin/serve -f app/assets/favicon.ico public/