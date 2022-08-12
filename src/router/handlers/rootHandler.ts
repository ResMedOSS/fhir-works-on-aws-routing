/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
    Search,
    History,
    KeyValueMap,
    Authorization,
    RequestContext,
    OperationBroker,
} from 'fhir-works-on-aws-interface';
import BundleGenerator from '../bundle/bundleGenerator';
import { hash } from './utils';

export default class RootHandler {
    private searchService: Search;

    private historyService: History;

    private authService: Authorization;

    private serverUrl: string;

    private broker: OperationBroker;

    constructor(
        searchService: Search,
        historyService: History,
        authService: Authorization,
        serverUrl: string,
        broker: OperationBroker,
    ) {
        this.searchService = searchService;
        this.historyService = historyService;
        this.authService = authService;
        this.serverUrl = serverUrl;
        this.broker = broker;
    }

    async globalSearch(
        queryParams: any,
        userIdentity: KeyValueMap,
        requestContext: RequestContext,
        serverUrl: string,
        tenantId?: string,
    ) {
        const searchFilters = await this.authService.getSearchFilterBasedOnIdentity({
            userIdentity,
            requestContext,
            operation: 'search-system',
            fhirServiceBaseUrl: serverUrl,
        });

        const request = {
            queryParams,
            baseUrl: this.serverUrl,
            searchFilters,
            tenantId,
            sessionId: hash(userIdentity),
        };
        const preHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            operation: 'pre-search-system',
        });

        if (!preHookResponse.success) {
            throw new Error(JSON.stringify(preHookResponse.errors));
        }
        const searchResponse = await this.searchService.globalSearch(request);

        const postHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            response: searchResponse,
            operation: 'post-search-system',
        });

        if (!postHookResponse.success) {
            throw new Error(JSON.stringify(postHookResponse.errors));
        }

        return BundleGenerator.generateBundle(this.serverUrl, queryParams, searchResponse.result, 'searchset');
    }

    async globalHistory(
        queryParams: any,
        userIdentity: KeyValueMap,
        requestContext: RequestContext,
        serverUrl: string,
        tenantId?: string,
    ) {
        const searchFilters = await this.authService.getSearchFilterBasedOnIdentity({
            userIdentity,
            requestContext,
            operation: 'history-system',
            fhirServiceBaseUrl: serverUrl,
        });

        const request = {
            queryParams,
            baseUrl: this.serverUrl,
            searchFilters,
            tenantId,
        };
        const preHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            operation: 'pre-history-system',
        });

        if (!preHookResponse.success) {
            throw new Error(JSON.stringify(preHookResponse.errors));
        }

        const historyResponse = await this.historyService.globalHistory(request);

        const postHookResponse = await this.broker.publish({
            userIdentity,
            timeStamp: new Date(),
            request,
            response: historyResponse,
            operation: 'post-history-system',
        });

        if (!postHookResponse.success) {
            throw new Error(JSON.stringify(postHookResponse.errors));
        }

        return BundleGenerator.generateBundle(this.serverUrl, queryParams, historyResponse.result, 'history');
    }
}
