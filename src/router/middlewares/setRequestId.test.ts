/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 *
 */

import express from 'express';
import { setRequestIdMiddleware } from './setRequestId';

describe('setRequestIdMiddleware', () => {
    test('Response should return a unique ID', async () => {
        const set = jest.fn();
        const req = { headers: {} } as unknown as express.Request;
        const res = {
            set,
        } as unknown as express.Response;

        setRequestIdMiddleware(req, res, () => {
            expect(set).toHaveBeenCalled();
            expect(set.mock.calls[0][0]).toBe('x-request-id');
            expect(set.mock.calls[0][1]).toMatch(/^[a-z,0-9,-]{36,36}$/);
        });
    });
});
