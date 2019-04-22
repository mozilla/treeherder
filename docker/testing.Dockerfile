FROM treeherder-backend:latest

#### Required for running Selenium tests ####
# Enable Firefox headless mode, avoiding the need for xvfb.
ENV MOZ_HEADLESS=1
ENV GECKODRIVER_VERSION='0.24.0'
RUN curl -sSfL "https://github.com/mozilla/geckodriver/releases/download/v${GECKODRIVER_VERSION}/geckodriver-v${GECKODRIVER_VERSION}-linux64.tar.gz" \
    | tar -zxC "/usr/local/bin" \
    && curl -sSfL 'https://download.mozilla.org/?product=firefox-beta-latest&lang=en-US&os=linux64' \
    | tar -jxC "/usr/local/bin"
    
#### Required for running shellcheck tests ####
ENV SHELLCHECK_VERSION="0.4.6"
RUN curl -sSfL "https://storage.googleapis.com/shellcheck/shellcheck-v${SHELLCHECK_VERSION}.linux.x86_64.tar.xz" \
    | tar -Jx --strip-components=1 -C /usr/local/bin