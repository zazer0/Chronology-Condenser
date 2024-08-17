### Given a matterJSON s3 path, splits into one JSON file per document ###
# Also, joins together each page string as it does so! #

import os
# requirements:
# wmill>=1.229.0
# duckdb==0.9.1
# azure-storage-blob==12.14.1
# pandas


import wmill
import duckdb
import json
from wmill import S3Object
import pandas as pd
from azure.storage.blob import BlobServiceClient


def main(target_s3_filepath: str):
    azure_details = wmill.get_resource("u/admin2/blocktry_azure_blob")
    account_name = azure_details["accountName"]
    account_key = azure_details["accessKey"]
    container_name = azure_details["containerName"]

    # Construct the connection string using the retrieved credentials
    connection_string = f"DefaultEndpointsProtocol=https;AccountName={account_name};AccountKey={account_key};EndpointSuffix=core.windows.net"

    # Create a DuckDB database in memory; Use Azure Blob SDK to read/write files
    conn = duckdb.connect()
    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    container_client = blob_service_client.get_container_client(container_name)

    # Unique identifier for this execution run
    job_uuid = os.environ.get("WM_JOB_ID")

    # Read the input file
    input_file = target_s3_filepath
    output_folder = f"output/{job_uuid}"
    blob_client = container_client.get_blob_client(input_file)
    # Read and process the input JSON file
    input_data = blob_client.download_blob().readall().decode("utf-8")
    df = pd.DataFrame(json.loads(input_data))

    # NB: I started with DuckDB/SQL because I thought Python would be too slow to process the JSON
    # However, it finished in <1 second; so I moved to optimising LLM calls instead
    conn.execute("CREATE TABLE temp_json AS SELECT * FROM df")
    query_result = conn.execute("SELECT * FROM temp_json")
    all_objects = query_result.fetchall()

    # Process objects in batches
    pagefile_s3_paths = []
    BATCH_SIZE = 100

    for i in range(0, len(all_objects), BATCH_SIZE):
        batch = all_objects[i : i + BATCH_SIZE]

        # Process each object in the batch
        for j, obj in enumerate(batch):
            pageArray = obj[1]

            # Concatenate each document's pageArrays into a single string
            # NB: I was going to calculate the average word confidence, but moved on to architecture
            df = pd.DataFrame(pageArray)
            df["text"] = df["words"].apply(
                lambda x: " ".join([word["content"] for word in x])
            )
            result_list = df[["text"]].to_dict("records")

            page_json = json.dumps(result_list)

            # Generate a unique filename for each object
            pageFile = f"{output_folder}/doc_{i+j}_pages.json"
            pagefile_s3_paths.append(pageFile)

            output_blob_client = container_client.get_blob_client(pageFile)
            output_blob_client.upload_blob(page_json, overwrite=True)

    # Return the path to the s3 output folder, for next script
    output_path = f"azure://{container_name}/{output_folder}"
    print(f"Success; {len(pagefile_s3_paths)} page files saved to {output_path}!")
    return pagefile_s3_paths
