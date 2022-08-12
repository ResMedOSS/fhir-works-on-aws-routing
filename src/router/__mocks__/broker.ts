/* eslint-disable */
import {
    OperationBroker,
    OperationEvent,
    OperationType,
    OperationEventResponse,
    AggregateOperationEventResponse,
} from 'fhir-works-on-aws-interface';

export default class BrokerMock implements OperationBroker {
    async publish(event: OperationEvent): Promise<AggregateOperationEventResponse> {
        return {
            success: true,
            responses: [],
            errors: [],
        };
    }

    subscribe(
        operations: OperationType[] = [],
        subscriber: (event: OperationEvent) => Promise<OperationEventResponse>,
    ): void {}

    unsubscribe(
        operations: OperationType[] = [],
        subscriber: (event: OperationEvent) => Promise<OperationEventResponse>,
    ): void {}
};