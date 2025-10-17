#!/bin/bash
# Set the backup and restore directories

BACKUP_DIR="/home/server/servicios/reddinamica/dump/reddinamica/"
RESTORE_DIR="/home/server/servicios/reddinamica/dump/reddinamica/"

ACTION=$1

if [ -z "$ACTION" ]; then
    echo "Please provide an action: 'dump' or 'restore'."
    exit 1
fi

if [ "$ACTION" == "dump" ]; then
    # Create the backup directory if it does not exist
    mkdir -p $BACKUP_DIR

    # Run mongodump on the reddinamica_mongo container
    docker exec reddinamica_db mongorestore --db reddinamica --drop --dir $RESTORE_DIR
    # Check if the mongodump process was successful
    if [ $? -eq 0 ]; then
        echo "mongodump process completed successfully."
    else
        echo "Error: mongodump process failed."
    fi

elif [ "$ACTION" == "restore" ]; then
    # Run mongorestore on the reddinamica_mongo container
    docker exec reddinamica_db mongorestore --drop --dir $RESTORE_DIR

    # Check if the mongorestore process was successful
    if [ $? -eq 0 ]; then
        echo "mongorestore process completed successfully."
    else
        echo "Error: mongorestore process failed."
    fi
else
    echo "Invalid action. Please provide 'dump' or 'restore'."
    exit 1
fi