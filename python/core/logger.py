import logging
import os
from datetime import datetime

def setup_transaction_logger():
    """
    Sets up a file-based logger for transaction processing with a unique, timestamped filename.
    """
    # Generate filename e.g., t_processing_log_09.21.25.T1432.txt
    log_dir = "docs/TransactionProcessingLogs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
        
    timestamp = datetime.now().strftime("%m.%d.%y.T%H%M")
    log_filename = os.path.join(log_dir, f"t_processing_log_{timestamp}.txt")

    # Get a logger instance
    logger = logging.getLogger('transaction_processor')
    
    # Avoid adding multiple handlers if called more than once
    if logger.hasHandlers():
        logger.handlers.clear()

    logger.setLevel(logging.INFO)

    # Create a file handler
    handler = logging.FileHandler(log_filename)
    handler.setLevel(logging.INFO)

    # Create a logging format
    formatter = logging.Formatter('%(asctime)s - %(message)s')
    handler.setFormatter(formatter)

    # Add the handler to the logger
    logger.addHandler(handler)

    return logger, log_filename

def get_transaction_logger():
    """
    Retrieves the configured transaction logger.
    """
    return logging.getLogger('transaction_processor')
