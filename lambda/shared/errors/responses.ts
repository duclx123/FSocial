import { APIResponse } from '../utils/types';
import { AppError as BaseAppError } from './errors';

// Backward compatible AppError wrapper
export class AppError extends BaseAppError {
  public errorCode: string;
  
  constructor(statusCode: number, errorCode: string, message: string, details: any = {}) {
    super({
      code: errorCode as any,
      message,
      statusCode,
      details,
      recoverable: false
    });
    this.errorCode = errorCode;
  }
}

export function successResponse(data: any, statusCode: number = 200): APIResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify({
      success: true,
      data
    }),
  };
}

export function errorResponse(
  statusCode: number,
  error: string,
  message: string,
  details: any = {}
): APIResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify({
      success: false,
      error,
      message,
      details,
      timestamp: new Date().toISOString(),
    }),
  };
}

export function handleError(error: any): APIResponse {
  console.log('HANDLEERROR DEBUG: Function called with error:', error?.message);
  console.error('Lambda Error:', {
    error: error.message,
    stack: error.stack,
    details: error.details || {},
  });

  // Always return a valid APIResponse - no matter what
  try {
    // Check for AppError properties first (statusCode and errorCode)
    if (error.statusCode && error.errorCode) {
      return {
        statusCode: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: error.errorCode,
          message: error.message,
          details: error.details || {},
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Check if it's an AppError instance
    if (error instanceof AppError) {
      return {
        statusCode: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: error.errorCode,
          message: error.message,
          details: error.details,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Handle AWS SDK errors
    if (error.name === 'ValidationException') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: 'validation_error',
          message: error.message,
          details: {},
          timestamp: new Date().toISOString(),
        }),
      };
    }

    if (error.name === 'ResourceNotFoundException') {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: 'resource_not_found',
          message: error.message,
          details: {},
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Handle DatabaseError from DynamoDB helper
    if (error.name === 'DatabaseError') {
      return {
        statusCode: error.statusCode || 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: error.code || 'database_error',
          message: error.message,
          details: error.details || {},
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Default internal server error
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      },
      body: JSON.stringify({
        success: false,
        error: 'internal_server_error',
        message: 'An unexpected error occurred',
        details: {},
        timestamp: new Date().toISOString(),
      }),
    };

  } catch (handlerError) {
    // If even the error handler fails, return a basic response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'critical_error',
        message: 'Critical error in error handler',
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

// Helper functions for common responses
export function badRequestResponse(message: string): APIResponse {
  return errorResponse(400, 'bad_request', message);
}

export function unauthorizedResponse(message: string = 'Authentication required'): APIResponse {
  return errorResponse(401, 'unauthorized', message);
}

export function forbiddenResponse(message: string = 'Access denied'): APIResponse {
  return errorResponse(403, 'forbidden', message);
}

export function notFoundResponse(message: string = 'Resource not found'): APIResponse {
  return errorResponse(404, 'not_found', message);
}
