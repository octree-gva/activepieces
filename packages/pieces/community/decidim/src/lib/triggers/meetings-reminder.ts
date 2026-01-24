
import { createTrigger, TriggerStrategy } from '@activepieces/pieces-framework';
export const meetingsReminder = createTrigger({
    // auth: check https://www.activepieces.com/docs/developers/piece-reference/authentication,
    name: 'meetingsReminder',
    displayName: 'Meetings Reminder',
    description: 'Trigger when a reminder of meetings is triggered',
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