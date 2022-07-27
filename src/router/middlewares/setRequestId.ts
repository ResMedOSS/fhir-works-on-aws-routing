/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 *
 */
import express from 'express';
import uuidv4 from 'uuid/v4';
import getComponentLogger from '../../loggerBuilder';

const logger = getComponentLogger();

/**
 * Set a unique uuid4 for every request to help w/triaging issues
 */
export const setRequestIdMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        res.set('x-request-id', uuidv4());

        next();
    } catch (e) {
        logger.error(`error setting x-request-id response header`, { e });

        // don't fail the request b/c we can't generate & attach a unique request ID
        next();
    }
};
