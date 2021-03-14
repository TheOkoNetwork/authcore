#!/bin/bash

project="$1"
if [ "$project" == "" ];then
	echo "Project MUST be provided as first arg"
	exit
fi
image=gcr.io/$project/authcore
region=europe-north1
service=authcore

gcloud config set project $project

echo "Building container image: $image"
gcloud builds submit --tag $image

echo "Deploying AuthCORE image: $image"
gcloud run deploy $service --image $image --platform managed --allow-unauthenticated --region $region
