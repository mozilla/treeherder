# Makefile for Sphinx documentation

SPHINXOPTS    = -n -W
SPHINXBUILD   = sphinx-build
BUILDDIR      = _build
SOURCEDIR     = docs

# User-friendly check for sphinx-build
ifeq ($(shell which $(SPHINXBUILD) >/dev/null 2>&1; echo $$?), 1)
$(error Sphinx not found. Run 'pip install -r requirements/docs.txt' first.)
endif

.PHONY: help clean html livehtml

help:
	@echo "Please use \`make <target>' where <target> is one of"
	@echo "  html       to make standalone HTML files"
	@echo "  livehtml   to start the live-reloading web server"

clean:
	rm -rf $(BUILDDIR)/*

html:
	$(SPHINXBUILD) -b html $(SPHINXOPTS) "$(SOURCEDIR)" "$(BUILDDIR)"
	@echo
	@echo "Build finished. The HTML pages are in $(BUILDDIR)."

livehtml:
	sphinx-autobuild -b html --poll $(SPHINXOPTS) $(SOURCEDIR) $(BUILDDIR) -B -p 8001
