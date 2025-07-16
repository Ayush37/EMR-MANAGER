# backend/services/azure_openai.py
# Add this at the top
import logging
import traceback

logger = logging.getLogger(__name__)

def get_access_token():
    try:
        logger.debug("Getting access token...")
        dir_path = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
        logger.debug(f"Directory path: {dir_path}")
        cert_path = dir_path + "/cert/apim-exp.pem"
        logger.debug(f"Certificate path: {cert_path}")
        
        if not os.path.exists(cert_path):
            logger.error(f"Certificate file does not exist at: {cert_path}")
            raise FileNotFoundError(f"Certificate file not found: {cert_path}")
        
        scope = "https://cognitiveservices.azure.com/.default"
        
        # Check environment variables
        for env_var in ["AZURE_SPN_CLIENT_ID", "AZURE_TENANT_ID"]:
            if env_var not in os.environ:
                logger.error(f"Environment variable {env_var} is not set")
                raise ValueError(f"Environment variable {env_var} is not set")
        
        credential = CertificateCredential(
            client_id=os.environ["AZURE_SPN_CLIENT_ID"],
            certificate_path=cert_path,
            tenant_id=os.environ["AZURE_TENANT_ID"],
            scope=scope,
            logging_enable=True  # Enable Azure SDK logging
        )
        
        access_token = credential.get_token(scope).token
        logger.debug("Access token obtained successfully")
        
        return access_token
    except Exception as e:
        logger.error(f"Error getting access token: {str(e)}")
        logger.error(traceback.format_exc())
        raise

def get_openai_response(message, history=None, function_result=None):
    """
    Get a response from Azure OpenAI API.
    """
    logger.debug(f"Getting OpenAI response for message: {message}")
    
    if history is None:
        history = []
    
    try:
        # Get access token
        token = get_access_token()
        
        # Check environment variables
        if "AZURE_OPENAI_ENDPOINT" not in os.environ:
            logger.error("AZURE_OPENAI_ENDPOINT environment variable is not set")
            raise ValueError("AZURE_OPENAI_ENDPOINT environment variable is not set")
            
        azure_endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
        logger.debug(f"Azure OpenAI Endpoint: {azure_endpoint}")
        
        # Initialize Azure OpenAI client
        logger.debug("Initializing OpenAI client...")
        client = AzureOpenAI(
            api_key=os.environ.get("AZURE_OPENAI_API_KEY", "placeholder-api-key"),
            azure_endpoint=azure_endpoint,
            api_version="2024-12-01-preview",
            default_headers={
                "Authorization": f"Bearer {token}",
                "user_sid": "1792420"
            }
        )
        
        # Construct messages for API
        logger.debug("Constructing messages for API request...")
        messages = [{"role": "system", "content": "You are LROT, an AI assistant that can help with various tasks."}]
        
        # Add chat history
        for entry in history:
            messages.append({"role": "user", "content": entry.get("user", "")})
            if "assistant" in entry:
                messages.append({"role": "assistant", "content": entry.get("assistant", "")})
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        # If we have a function result, add it
        if function_result:
            messages.append({
                "role": "function", 
                "name": function_result.get("name", ""),
                "content": json.dumps(function_result.get("result", {}))
            })
        
        # Define available functions
        # Define available functions
        functions = [
        {   
            "name": "sls_details_variance",
            "description": "Calculate comprehensive variance or drops for 6G (2052a)data between two dates",
            "parameters": {
                "type": "object",
                "properties": {
                    "date1": {"type": "string", "description": "First date in format YYYY-MM-DD"},
                    "date2": {"type": "string", "description": "Second date in format YYYY-MM-DD"},
                    "product_identifiers": {"type": "string", "description": "Optional: Comma-separated list of product identifiers (e.g., 'OS-09,OS-10')"}
                },
                "required": ["date1", "date2"]
            }
        },
            {
                "name": "sls_details_variance",
                "description": "Calculate variance for SLS details between two dates",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "date1": {"type": "string", "description": "First date in format YYYY-MM-DD"},
                        "date2": {"type": "string", "description": "Second date in format YYYY-MM-DD"}
                    },
                    "required": ["date1", "date2"]
                }
            },
            {
                "name": "time_remaining",
                "description": "Get current time and time remaining until EOD (5PM EST)",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "get_6g_status",
                "description": "Get the status of the FR2052a (6G) batch process for a specific date",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "cob_date": {"type": "string", "description": "The COB date in MM-DD-YYYY format"},
                        "table_name": {"type": "string", "description": "Optional: Specific table name or BPF ID to check"}
                    },
                    "required": ["cob_date"]
                }
            },
            {
                "name": "sync_adjustments",
                "description": "Clear or sync stuck adjustments for specified DMAT IDs",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "adjustment_type": {"type": "string", "description": "Type of adjustment - either 'MDU' or 'MSDU'"},
                        "dmat_ids": {"type": "string", "description": "Comma-separated list of DMAT IDs to sync (e.g., '2015305,2015306')"}
                    },
                    "required": ["adjustment_type", "dmat_ids"]
                }
            }            
        ]
#        functions = [
#            {
#                "name": "sls_details_variance",
#                "description": "Calculate variance for SLS details between two dates",
#                "parameters": {
#                    "type": "object",
#                    "properties": {
#                        "date1": {"type": "string", "description": "First date in format YYYY-MM-DD"},
#                        "date2": {"type": "string", "description": "Second date in format YYYY-MM-DD"}
#                    },
#                    "required": ["date1", "date2"]
#                }
#            },
#            {
#                "name": "time_remaining",
#                "description": "Get current time and time remaining until EOD (5PM EST)",
#                "parameters": {
#                    "type": "object",
#                    "properties": {}
#                }
#            }
#        ]

        # Call Azure OpenAI API
        logger.debug("Calling OpenAI API...")
        response = client.chat.completions.create(
            model="gpt-4o-2024-08-06",
            messages=messages,
            functions=functions,
            function_call="auto"
        )
        
        logger.debug(f"OpenAI API response received: {response}")
        
        return response.choices[0].message
        
    except Exception as e:
        logger.error(f"Error in get_openai_response: {str(e)}")
        logger.error(traceback.format_exc())
        raise
