#
# Vars
#

NODE_BIN = ./node_modules/.bin

#
# Tasks
# 

validate:
	@${NODE_BIN}/standard *.js

test:
	@${NODE_BIN}/tape test/*.js

ci: validate test

.PHONY: test validate ci