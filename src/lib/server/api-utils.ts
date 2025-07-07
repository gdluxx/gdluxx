import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';

export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	timestamp: string;
}


export const createApiResponse = <T>(data: T): Response => {
	const response: ApiResponse<T> = {
		success: true,
		data,
		timestamp: new Date().toISOString()
	};
	return json(response);
};

export const createApiError = (message: string, statusCode = 500): Response => {
	const errorResponse: ApiResponse = {
		success: false,
		error: message,
		timestamp: new Date().toISOString()
	};
	return json(errorResponse, { status: statusCode });
};

export const getClientSafeMessage = (err: Error): string => {
	if (dev) {
		return err.message;
	}

	if (err.name === 'ValidationError') {
		return 'Invalid input provided.';
	}
	if (err.name === 'NotFoundError') {
		return 'Resource not found.';
	}
	if (err.name === 'AuthenticationError') {
		return 'Authentication required.';
	}
	if (err.name === 'AuthorizationError') {
		return 'Insufficient permissions.';
	}

	return 'An unexpected error occurred.';
};

export const handleApiError = (err: unknown): Response => {
	const message = err instanceof Error ? getClientSafeMessage(err) : 'An unexpected error occurred.';
	return createApiError(message, 500);
};