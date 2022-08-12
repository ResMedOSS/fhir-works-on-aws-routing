/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
    Search,
    History,
    Persistence,
    Authorization,
    KeyValueMap,
    Validator,
    RequestContext,
    OperationBroker,
} from 'fhir-works-on-aws-interface';
import BundleGenerator from '../bundle/bundleGenerator';
import CrudHandlerInterface from './CrudHandlerInterface';
import OperationsGenerator from '../operationsGenerator';
import { validateResource } from '../validation/validationUtilities';
import { hash } from './utils';

export default class ResourceHandler implements CrudHandlerInterface {
    private validators: Validator[];

    private dataService: Persistence;

    private searchService: Search;

    private historyService: History;

    private authService: Authorization;

    private broker: OperationBroker;

    constructor(
        dataService: Persistence,
        searchService: Search,
        historyService: History,
        authService: Authorization,
        serverUrl: string,
        validators: Validator[],
        broker: OperationBroker,
    ) {
        this.validators = validators;
        this.dataService = dataService;
        this.searchService = searchService;
        this.historyService = historyService;
        this.authService = authService;
        this.broker = broker;
    }

    async create(resourceType: string, resource: any, userIdentity: KeyValueMap, tenantId?: string) {
        await validateResource(this.validators, resource, { tenantId, typeOperation: 'create' });

        const request = { resourceType, resource, tenantId };
        const preHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            operation: 'pre-create',
        });

        if (!preHookResponse.success) {
            throw new Error(JSON.stringify(preHookResponse.errors));
        }

        const createResponse = await this.dataService.createResource(request);

        const postHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            response: createResponse,
            operation: 'post-create',
        });

        if (!postHookResponse.success) {
            throw new Error(JSON.stringify(postHookResponse.errors));
        }

        return createResponse.resource;
    }

    async update(resourceType: string, id: string, resource: any, userIdentity: KeyValueMap, tenantId?: string) {
        await validateResource(this.validators, resource, { tenantId, typeOperation: 'update' });

        const request = { resourceType, id, resource, tenantId };
        const preHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            operation: 'pre-update',
        });

        if (!preHookResponse.success) {
            throw new Error(JSON.stringify(preHookResponse.errors));
        }

        const updateResponse = await this.dataService.updateResource(request);

        const postHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            response: updateResponse,
            operation: 'post-update',
        });

        if (!postHookResponse.success) {
            throw new Error(JSON.stringify(postHookResponse.errors));
        }

        return updateResponse.resource;
    }

    async patch(resourceType: string, id: string, resource: any, userIdentity: KeyValueMap, tenantId?: string) {
        // TODO Add request validation around patching

        const request = { resourceType, id, resource, tenantId };
        const preHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            operation: 'pre-patch',
        });

        if (!preHookResponse.success) {
            throw new Error(JSON.stringify(preHookResponse.errors));
        }

        const patchResponse = await this.dataService.patchResource(request);

        const postHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            response: patchResponse,
            operation: 'post-patch',
        });

        if (!postHookResponse.success) {
            throw new Error(JSON.stringify(postHookResponse.errors));
        }

        return patchResponse.resource;
    }

    async typeSearch(
        resourceType: string,
        queryParams: any,
        userIdentity: KeyValueMap,
        requestContext: RequestContext,
        serverUrl: string,
        tenantId?: string,
    ) {
        const allowedResourceTypes = await this.authService.getAllowedResourceTypesForOperation({
            operation: 'search-type',
            userIdentity,
            requestContext,
        });

        const searchFilters = await this.authService.getSearchFilterBasedOnIdentity({
            userIdentity,
            requestContext,
            operation: 'search-type',
            resourceType,
            fhirServiceBaseUrl: serverUrl,
        });

        const request = {
            resourceType,
            queryParams,
            baseUrl: serverUrl,
            allowedResourceTypes,
            searchFilters,
            tenantId,
            sessionId: hash(userIdentity),
        };
        const preHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            operation: 'pre-search-type',
        });

        if (!preHookResponse.success) {
            throw new Error(JSON.stringify(preHookResponse.errors));
        }

        const searchResponse = await this.searchService.typeSearch(request);

        const postHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            response: searchResponse,
            operation: 'post-search-type',
        });

        if (!postHookResponse.success) {
            throw new Error(JSON.stringify(postHookResponse.errors));
        }

        const bundle = BundleGenerator.generateBundle(
            serverUrl,
            queryParams,
            searchResponse.result,
            'searchset',
            resourceType,
        );

        return this.authService.authorizeAndFilterReadResponse({
            operation: 'search-type',
            userIdentity,
            requestContext,
            readResponse: bundle,
            fhirServiceBaseUrl: serverUrl,
        });
    }

    async typeHistory(
        resourceType: string,
        queryParams: any,
        userIdentity: KeyValueMap,
        requestContext: RequestContext,
        serverUrl: string,
        tenantId?: string,
    ) {
        const searchFilters = await this.authService.getSearchFilterBasedOnIdentity({
            userIdentity,
            requestContext,
            operation: 'history-type',
            resourceType,
            fhirServiceBaseUrl: serverUrl,
        });

        const request = {
            resourceType,
            queryParams,
            baseUrl: serverUrl,
            searchFilters,
            tenantId,
        };
        const preHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            operation: 'pre-history-type',
        });

        if (!preHookResponse.success) {
            throw new Error(JSON.stringify(preHookResponse.errors));
        }

        const historyResponse = await this.historyService.typeHistory(request);

        const postHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            response: historyResponse,
            operation: 'post-history-type',
        });

        if (!postHookResponse.success) {
            throw new Error(JSON.stringify(postHookResponse.errors));
        }

        return BundleGenerator.generateBundle(serverUrl, queryParams, historyResponse.result, 'history', resourceType);
    }

    async instanceHistory(
        resourceType: string,
        id: string,
        queryParams: any,
        userIdentity: KeyValueMap,
        requestContext: RequestContext,
        serverUrl: string,
        tenantId?: string,
    ) {
        const searchFilters = await this.authService.getSearchFilterBasedOnIdentity({
            userIdentity,
            requestContext,
            operation: 'history-instance',
            resourceType,
            id,
            fhirServiceBaseUrl: serverUrl,
        });

        const request = {
            id,
            resourceType,
            queryParams,
            baseUrl: serverUrl,
            searchFilters,
            tenantId,
        };
        const preHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            operation: 'pre-history-instance',
        });

        if (!preHookResponse.success) {
            throw new Error(JSON.stringify(preHookResponse.errors));
        }

        const historyResponse = await this.historyService.instanceHistory(request);

        const postHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            response: historyResponse,
            operation: 'post-history-instance',
        });

        if (!postHookResponse.success) {
            throw new Error(JSON.stringify(postHookResponse.errors));
        }

        return BundleGenerator.generateBundle(
            serverUrl,
            queryParams,
            historyResponse.result,
            'history',
            resourceType,
            id,
        );
    }

    async read(resourceType: string, id: string, userIdentity: KeyValueMap, tenantId?: string) {
        const request = { resourceType, id, tenantId };
        const preHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            operation: 'pre-read',
        });

        if (!preHookResponse.success) {
            throw new Error(JSON.stringify(preHookResponse.errors));
        }

        const getResponse = await this.dataService.readResource(request);

        const postHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            response: getResponse,
            operation: 'post-read',
        });

        if (!postHookResponse.success) {
            throw new Error(JSON.stringify(postHookResponse.errors));
        }

        return getResponse.resource;
    }

    async vRead(resourceType: string, id: string, vid: string, userIdentity: KeyValueMap, tenantId?: string) {
        const request = { resourceType, id, vid, tenantId };
        const preHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            operation: 'pre-vread',
        });

        if (!preHookResponse.success) {
            throw new Error(JSON.stringify(preHookResponse.errors));
        }

        const getResponse = await this.dataService.vReadResource(request);

        const postHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            response: getResponse,
            operation: 'post-vread',
        });

        if (!postHookResponse.success) {
            throw new Error(JSON.stringify(postHookResponse.errors));
        }

        return getResponse.resource;
    }

    async delete(resourceType: string, id: string, userIdentity: KeyValueMap, tenantId?: string) {
        const request = { resourceType, id, tenantId };
        const preHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            operation: 'pre-delete',
        });

        if (!preHookResponse.success) {
            throw new Error(JSON.stringify(preHookResponse.errors));
        }

        const deleteResponse = await this.dataService.deleteResource(request);

        const postHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            response: deleteResponse,
            operation: 'post-delete',
        });

        if (!postHookResponse.success) {
            throw new Error(JSON.stringify(postHookResponse.errors));
        }

        return OperationsGenerator.generateSuccessfulDeleteOperation();
    }
}
