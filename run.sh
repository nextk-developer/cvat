#!/bin/bash

cmd=$1

case $cmd in
up)
    docker-compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.dev.yml -f components/serverless/docker-compose.serverless.yml up -d
    ;;
up_build)
    docker-compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.dev.yml -f components/serverless/docker-compose.serverless.yml up -d --build
    ;;
down)
    docker-compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.dev.yml -f components/serverless/docker-compose.serverless.yml down
    ;;
down_volume)
    docker-compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.dev.yml -f components/serverless/docker-compose.serverless.yml down -v
    ;;
create_superuser)
    docker exec -it cvat_server bash -ic 'python3 ~/manage.py createsuperuser'
    ;;
*)
    echo "Unkown comand"
    exit 1
    ;;
esac

