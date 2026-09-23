FROM postgres:16-alpine

RUN apk add --no-cache aws-cli bash coreutils

COPY railway-backup.sh /usr/local/bin/railway-backup.sh
RUN chmod 0755 /usr/local/bin/railway-backup.sh

ENTRYPOINT ["/usr/local/bin/railway-backup.sh"]
