
import { createTrigger, TriggerStrategy } from '@activepieces/pieces-framework';
export const proposalPublished = createTrigger({
    // auth: check https://www.activepieces.com/docs/developers/piece-reference/authentication,
    name: 'proposalPublished',
    displayName: 'Proposal Published',
    description: 'A proposal is published',
    props: {},
    sampleData: {},
    type: TriggerStrategy.WEBHOOK,
    async onEnable(context){
        // implement webhook creation logic
    },
    async onDisable(context){
        // implement webhook deletion logic
    },
    async run(context){
        return [context.payload.body]
    }
})