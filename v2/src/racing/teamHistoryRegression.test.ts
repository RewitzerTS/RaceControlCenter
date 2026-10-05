import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { driverStats, historySnapshot, type HistoryData } from './profileData';
import { buildGrid } from './gridData';
import type { ResultsData } from './resultsData';

function history(): HistoryData {
 const seasons = [{id:'s14',name:'14',is_active:false,start_date:'2025-01-01',created_at:'2025-01-01'}, {id:'s15',name:'15',is_active:true,start_date:'2026-10-01',created_at:'2026-10-01'}];
 const races = Array.from({length:24}, (_,i) => ({id:'r'+i,season_id:'s14',round_number:i+1,grand_prix_name:'Japan GP',circuit_name:'Suzuka',country_code:'JP',status:'completed',current_result_version_id:'v'+i,race_date:'2025-02-01',race_start_at:null,race_time:null,weather:null}));
 return {leagueId:'l',seasons,drivers:[{id:'richard',display_name:'Richard',gamertag:null,car_name:'Mercedes',league_team:'Blackflag Racing',is_active:true}],races,
 results:races.map((r,i)=>({id:'result'+i,race_id:r.id,result_version_id:r.current_result_version_id,driver_id:'richard',points_owner_driver_id:'richard',awarded_points:25,finish_position:1,grid_position:1,participation_status:'HUMAN',fastest_lap_time_ms:null,fastest_lap_ms:null,fastest_lap_time:null,race_time:null,points_car_name:null,car_name_snapshot:null,points_team_name:null})), assignments:[],profileNumbers:{},
 currentRosters:[{season_id:'s15',driver_id:'richard',team_name:'Blackflag Racing',car_name:'Mercedes'}]};
}
describe('season-correct team history', () => {
 it('also corrects the older personal Career profile without touching scores', () => {
  const data=history();
  data.assignments=[{season_id:'s14',driver_id:'richard',team_name:'Safety Car Specialists',car_name:null,created_at:'2026-10-05',effective_round_number:1}];
  const context: Record<string, any>={window:{}};
  for(const file of ['rcc-data.js','rcc-result-data-compat.js','rcc-driver-context.js','rcc-driver-stats.js']) runInNewContext(readFileSync(`../assets/js/services/${file}`,'utf8'),context);
  const legacy={...data,completedRaces:data.races,raceResults:data.results,seasonsById:new Map(data.seasons.map(s=>[s.id,s])),driversById:new Map(data.drivers.map(d=>[d.id,d])),resultsByRace:new Map(data.races.map(r=>[r.id,data.results.filter(row=>row.race_id===r.id)])),fastestByRace:new Map(),resolver:context.window.RCCDriverContext.createAssignmentResolver(data)};
  const stats=context.window.RCCDriverStats.calculateDriverStats('richard',legacy);
  expect(stats.teamHistory).toEqual(expect.arrayContaining([expect.objectContaining({team:'Safety Car Specialists',starts:24,seasonId:'s14'}),expect.objectContaining({team:'Blackflag Racing',starts:0,seasonId:'s15'})]));
  expect(stats.starts).toBe(24); expect(stats.points).toBe(600);
  legacy.resolver=context.window.RCCDriverContext.createAssignmentResolver({...data,assignments:[]});
  expect(context.window.RCCDriverStats.calculateDriverStats('richard',legacy).teamHistory[0]).toMatchObject({team:'Nicht hinterlegt',starts:24});
 });
 it('records confirmed 24 old-team starts and zero new-team starts without changing results', () => {
  const data=history(); data.assignments=[{season_id:'s14',driver_id:'richard',team_name:'Safety Car Specialists',car_name:null,created_at:'2026-10-05',effective_round_number:1}];
  const before=JSON.stringify(data.results); const stats=driverStats(data,'richard');
  expect(stats.teams).toEqual(expect.arrayContaining([expect.objectContaining({seasonId:'s14',team:'Safety Car Specialists',starts:24}),expect.objectContaining({seasonId:'s15',team:'Blackflag Racing',starts:0})]));
  expect(stats.starts).toBe(24); expect(stats.points).toBe(600); expect(JSON.stringify(data.results)).toBe(before);
  expect(driverStats(data,'richard','s15').teams).toHaveLength(1);
 });
 it('never borrows the current team for missing historical evidence', () => {
  const data=history(); expect(historySnapshot(data,'richard',data.races[0])).toMatchObject({league_team:'',teamKnown:false,car_name:''});
  expect(driverStats(data,'richard').teams.find(t=>t.seasonId==='s14')).toMatchObject({team:'',starts:24,known:false});
 });
 it('published snapshots override later assertions and empty snapshots mean no team', () => {
  const data=history(); data.assignments=[{season_id:'s14',driver_id:'richard',team_name:'Assigned',car_name:'Car',created_at:'',effective_round_number:1}];
  data.results[0].points_team_name='Published'; expect(historySnapshot(data,'richard',data.races[0]).league_team).toBe('Published');
  data.results[0].points_team_name=''; expect(historySnapshot(data,'richard',data.races[0])).toMatchObject({league_team:'',teamKnown:true});
 });
 it('applies a team change only from the selected round', () => {
  const data=history(); data.assignments=[{season_id:'s14',driver_id:'richard',team_name:'Old',car_name:null,created_at:'',effective_round_number:1},{season_id:'s14',driver_id:'richard',team_name:'New',car_name:null,created_at:'',effective_round_number:13}];
  expect(driverStats(data,'richard','s14').teams.map(t=>[t.team,t.starts])).toEqual([['Old',12],['New',12]]);
 });
});
describe('effective grid', () => {
 it('puts Richard and AI Piastri in their effective shared team, not stale manufacturer teams', () => {
  const data: ResultsData = {season:{id:'s15',name:'15'},drivers:[{id:'r',display_name:'Richard',gamertag:null,car_name:'Mercedes',league_team:'Previous',is_active:true},{id:'p',display_name:'Oscar Piastri',gamertag:null,car_name:'McLaren',league_team:'McLaren',is_active:true}],assignments:[{driver_id:'r',car_name:'Mercedes',created_at:'',team_name:'',participant_type:'PLAYER'},{driver_id:'p',car_name:'McLaren',created_at:'',team_name:'McLaren',participant_type:'BOT',ai_driver_name:'Oscar Piastri'}],races:[],results:[]};
  const currentRoster=data.drivers.map(d=>({driver_id:d.id,team_name:'Blackflag Racing',car_name:d.car_name}));
  const grid=buildGrid({...data,currentRoster}); expect(grid.groups).toHaveLength(1); expect(grid.groups[0].members).toHaveLength(2); expect(grid.groups[0].name).toBe('Blackflag Racing');
  expect(buildGrid({...data,currentRoster:[]}).seats).toEqual([]);
  expect(buildGrid({...data,currentRoster:[{driver_id:'r',team_name:null,car_name:null}]}).seats[0].team).toBe('');
 });
});
