import { describe, expect, it } from 'vitest';
import { notificationPresentation } from './notificationPresentation';
import type { InboxNotification } from './operations';
const item=(payload: InboxNotification['payload']):InboxNotification=>({id:'test',notification_kind:'system',title_key:'test',body_key:'test',payload,created_at:'2026-10-05',read_at:null});
describe('new inbox events',()=>{
 it('opens membership review in the originating league',()=>expect(notificationPresentation(item({event_type:'league.join_requested',league_slug:'qa-league'})).target).toBe('/admin/users?league=qa-league'));
 it('opens steward cases with their safe reference',()=>expect(notificationPresentation(item({event_type:'steward.case_opened',league_slug:'qa',case_number:'RV-12',evidence:'not exposed'}))).toEqual({categoryKey:'notification.kind.steward',params:{caseNumber:'RV-12'},reference:'RV-12',target:'/stewarding?league=qa'}));
 it('opens the career for a level up',()=>expect(notificationPresentation(item({event_type:'career.level_up',level:7}))).toMatchObject({target:'/career',params:{level:7}}));
});
