use serde::Deserialize;
use std::{cmp::Ordering,env,fs};
#[derive(Clone,Deserialize)]struct Kernel{cards:Vec<Card>,leaders:Vec<Leader>,charts:Vec<Chart>}
#[derive(Clone,Deserialize)]struct Progression{p:[f64;3],passive:Vec<Op>,active:Vec<Op>,special:Vec<Op>,cooldown:f64,duration:f64,probability:f64,#[serde(rename="specialDuration")]special_duration:f64}
#[derive(Clone,Deserialize)]struct Card{id:String,talent:String,rarity:u8,attr:u8,groups:u32,p:[f64;3],passive:Vec<Op>,active:Vec<Op>,special:Vec<Op>,cooldown:f64,duration:f64,probability:f64,#[serde(rename="specialDuration")]special_duration:f64,progressions:std::collections::HashMap<String,Progression>}
#[derive(Clone,Deserialize)]struct Leader{id:String,applications:Vec<Op>}
#[allow(non_snake_case,dead_code)]#[derive(Clone,Deserialize)]struct Chart{key:String,noteCount:usize,duration:f64,#[serde(default)]singers:Vec<String>}
#[derive(Clone,Deserialize)]struct Op{h:u8,c:u8,k:u8,v:f64,t:u8,a:i8,g:u32,n:u8,r:u8,q:f64,ra:i8,rg:u32}
const SCORE:u8=1;const SUPPORT:u8=2;const ACTIVATION:u8=3;const PERF:u8=4;const TECH:u8=5;const SENSE:u8=6;const ALL:u8=7;const ACTIVE_SUPPORT:u8=8;
#[derive(Clone,Copy,Debug)]struct I{l:f64,c:f64,u:f64}
fn ir(l:f64,c:f64,u:f64)->I{let c=c.max(l).min(u);I{l:round6(l),c:round6(c),u:round6(u.max(c))}}
fn iz(v:f64)->I{ir(v,v,v)}
fn iar(a:I,b:I)->I{I{l:a.l+b.l,c:a.c+b.c,u:a.u+b.u}}
fn imin(values:&[f64])->f64{values.iter().copied().fold(f64::INFINITY,f64::min)}
fn imax(values:&[f64])->f64{values.iter().copied().fold(f64::NEG_INFINITY,f64::max)}
#[derive(Clone,Copy)]struct Ctx{ids:[usize;5],attrs:[u8;3],base:f64}
fn trig(o:&Op,x:&Ctx,c:&[Card],combo:Option<usize>)->bool{match o.r{0=>true,1=>combo.map(|n|n as f64>=o.q).unwrap_or(false),2=>o.ra>=0&&x.attrs[o.ra as usize]as f64>=o.q,3=>(0..5).filter(|i|c[x.ids[*i]].groups&o.rg!=0).count()as f64>=o.q,4=>1000.>=o.q,_=>false}}
fn elig(o:&Op,i:usize,x:&Ctx,c:&[Card])->bool{match o.t{1=>true,3=>o.a>=0&&c[x.ids[i]].attr==o.a as u8,4=>c[x.ids[i]].groups&o.g!=0,_=>false}}
fn pv(c:&Card,k:u8)->f64{match k{PERF=>c.p[0],TECH=>c.p[1],SENSE=>c.p[2],ALL=>c.p.iter().sum(),_=>0.}}
fn minp(o:&Op,src:Option<usize>,x:&Ctx,c:&[Card])->f64{if o.t==2{return src.map(|i|pv(&c[x.ids[i]],o.k)).unwrap_or(0.)}let mut v:Vec<f64>=(0..5).filter(|&i|elig(o,i,x,c)).map(|i|pv(&c[x.ids[i]],o.k)).collect();if v.is_empty(){return 0.}let n=if o.n==0{v.len()}else{(o.n as usize).min(v.len())};v.sort_by(|a,b|a.partial_cmp(b).unwrap_or(Ordering::Equal));v.into_iter().take(n).sum()}
fn floor(o:&Op,src:Option<usize>,x:&Ctx,c:&[Card],i:usize)->f64{if o.t==2{return if src==Some(i){1.}else{0.}}if !elig(o,i,x,c){return 0.}if o.t==1{return 1.}let e=(0..5).filter(|&j|elig(o,j,x,c)).count();let n=if o.n==0{e}else{(o.n as usize).min(e)};if e<=n{1.}else{0.}}
fn combos(values:&[usize],size:usize)->Vec<Vec<usize>>{if size==0{return vec![Vec::new()]}if values.len()<size{return Vec::new()}let head=values[0];let mut result=Vec::new();for mut tail in combos(&values[1..],size-1){tail.insert(0,head);result.push(tail)}result.extend(combos(&values[1..],size));result}
fn targets(o:&Op,src:Option<usize>,x:&Ctx,c:&[Card])->Vec<Vec<usize>>{let eligible:Vec<usize>=(0..5).filter(|&i|match o.t{0=>false,1=>true,2=>src==Some(i),3=>o.a>=0&&c[x.ids[i]].attr==o.a as u8,4=>c[x.ids[i]].groups&o.g!=0,_=>false}).collect();if o.t==0{return vec![Vec::new()]}let count=if o.n==0{eligible.len()}else{(o.n as usize).min(eligible.len())};combos(&eligible,count)}
fn param_i(o:&Op,src:Option<usize>,x:&Ctx,c:&[Card])->I{if !matches!(o.k,PERF|TECH|SENSE|ALL){return iz(0.)}let values:Vec<f64>=targets(o,src,x,c).into_iter().map(|recipients|recipients.into_iter().map(|i|pv(&c[x.ids[i]],o.k)*o.v/1000.).sum()).collect();if values.is_empty(){iz(0.)}else{let lo=imin(&values);ir(lo,lo,imax(&values))}}
fn support_i(o:&Op,src:Option<usize>,x:&Ctx,c:&[Card],member:usize)->I{if o.k!=ACTIVE_SUPPORT{return iz(0.)}let alts=targets(o,src,x,c);if alts.is_empty(){return iz(0.)}let min=alts.iter().all(|alt|alt.contains(&member));let max=alts.iter().any(|alt|alt.contains(&member));ir(if min{o.v}else{0.},if min{o.v}else{0.},if max{o.v}else{0.})}
fn memb_bounds(x:&Ctx,c:&[Card])->(I,[I;5]){let(mut p,mut s)=(iz(0.),[iz(0.);5]);for si in 0..5{for o in c[x.ids[si]].passive.iter().filter(|o|trig(o,x,c,Some(usize::MAX))){p=iar(p,param_i(o,Some(si),x,c));for i in 0..5{s[i]=iar(s[i],support_i(o,Some(si),x,c,i));}}}(ir(p.l,p.c,p.u),s.map(|v|ir(v.l,v.c,v.u)))}
fn lead_bounds(l:&Leader,x:&Ctx,c:&[Card])->(I,[I;5]){let(mut p,mut s)=(iz(0.),[iz(0.);5]);for o in l.applications.iter().filter(|o|trig(o,x,c,Some(usize::MAX))){p=iar(p,param_i(o,None,x,c));for i in 0..5{s[i]=iar(s[i],support_i(o,None,x,c,i));}}(ir(p.l,p.c,p.u),s.map(|v|ir(v.l,v.c,v.u)))}
fn memb(x:&Ctx,c:&[Card])->(f64,[f64;5]){let(mut p,mut s)=(0.,[0.;5]);for si in 0..5{for o in c[x.ids[si]].passive.iter().filter(|o|trig(o,x,c,Some(usize::MAX))){if matches!(o.k,PERF|TECH|SENSE|ALL){p+=minp(o,Some(si),x,c)*o.v/1000.}if o.k==ACTIVE_SUPPORT{for i in 0..5{s[i]+=o.v*floor(o,Some(si),x,c,i)}}}}(p,s)}
fn lead(l:&Leader,x:&Ctx,c:&[Card])->(f64,[f64;5]){let(mut p,mut s)=(0.,[0.;5]);for o in l.applications.iter().filter(|o|trig(o,x,c,Some(usize::MAX))){if matches!(o.k,PERF|TECH|SENSE|ALL){p+=minp(o,None,x,c)*o.v/1000.}if o.k==ACTIVE_SUPPORT{for i in 0..5{s[i]+=o.v*floor(o,None,x,c,i)}}}(p,s)}
fn specials(card:&Card,x:&Ctx,c:&[Card])->(f64,f64){let(mut s,mut a)=(0.,0.);for o in &card.special{if o.r==1||!trig(o,x,c,Some(usize::MAX)){continue}if o.k==SUPPORT{s+=o.v}if o.k==ACTIVATION{a+=o.v}}(s,a)}
fn active(card:&Card,x:&Ctx,c:&[Card],combo:usize)->f64{let(mut sum,mut over)=(0.,None);for o in &card.active{if o.k!=SCORE||!trig(o,x,c,Some(combo)){continue}if o.c==2{over=Some(o.v)}else{sum+=o.v}}over.unwrap_or(sum)}
fn prob(n:usize,b:f64,a:f64)->f64{if n==0{return 0.}let p=((b+a).max(0.)).min(1000.)/1000.;let mut no=1.;for _ in 0..n{no*=1.-p;}1.-no}
fn emax(v:&mut[(f64,f64);5])->f64{v.sort_by(|a,b|b.0.partial_cmp(&a.0).unwrap_or(Ordering::Equal));let(mut z,mut nh)=(0.,1.);let mut i=0;while i<v.len(){let q=v[i].0;if q<=0.{i+=1;continue}let mut no=1.;let mut cursor=i;while cursor<v.len()&&((v[cursor].0-q).abs()<1e-9){no*=1.-v[cursor].1;cursor+=1;}z+=q*nh*(1.-no);nh*=no;i=cursor;}z}
fn score(x:&Ctx,l:&Leader,ch:&Chart,c:&[Card],mp:f64,ms:&[f64;5],ss:f64,sa:f64)->f64{let(lp,ls)=lead(l,x,c);let mut total=0.;for n in 0..ch.noteCount{let at=(n as f64+0.5)*ch.duration/ch.noteCount as f64;let mut v=[(0.,0.);5];for i in 0..5{let q=&c[x.ids[i]];let last=(at/q.cooldown).floor()as i64;let first=(((at-q.duration)/q.cooldown).floor()as i64+1).max(1);let checks=if last>=first{(last-first+1)as usize}else{0};v[i]=(active(q,x,c,n+1)*(1000.+ms[i]+ls[i]+ss)/1000.,prob(checks,q.probability,sa))}total+=emax(&mut v)}let active_average=round6(total/ch.noteCount as f64);let active_units=round6(active_average*x.base/1000.);let parameter_units=round6(lp+mp);round6(x.base+parameter_units+active_units)}
fn active_bounds(x:&Ctx,ch:&Chart,c:&[Card],supports:&[I;5],extra:f64,activation:f64,with_special_support:bool)->I{let mut lo=0.;let mut ce=0.;let mut up=0.;for n in 0..ch.noteCount{let at=(n as f64+0.5)*ch.duration/ch.noteCount as f64;let mut lower_entries=[(0.,0.);5];let mut central_entries=[(0.,0.);5];let mut upper_entries=[(0.,0.);5];for i in 0..5{let q=&c[x.ids[i]];let last=(at/q.cooldown).floor()as i64;let first=(((at-q.duration)/q.cooldown).floor()as i64+1).max(1);let checks=if last>=first{(last-first+1)as usize}else{0};let p=prob(checks,q.probability,0.);let boosted=prob(checks,q.probability,activation);let selected=iz(active(q,x,c,n+1));let support=if with_special_support{supports[i]}else{supports[i]};let add=if with_special_support{extra}else{0.};let lv=selected.l*(1000.+support.l+add)/1000.;let cv=selected.c*(1000.+support.c+add)/1000.;let uv=selected.u*(1000.+support.u+add)/1000.;lower_entries[i]=(lv,p);central_entries[i]=(cv,boosted);upper_entries[i]=(uv,boosted);}lo+=lower_entries.iter().map(|(v,p)|v*p).fold(0.,f64::max);ce+=emax(&mut central_entries);up+=upper_entries.iter().map(|(v,p)|v*p).sum::<f64>();}ir(lo/ch.noteCount as f64,ce/ch.noteCount as f64,up/ch.noteCount as f64)}
fn special_raw(x:&Ctx,ch:&Chart,c:&[Card])->(f64,f64){let(mut ss,mut sa)=(0.,0.);for &id in &x.ids{let mut support=0.;let mut activation=0.;for o in &c[id].special{if o.r==1||!trig(o,x,c,None){continue}if o.k==SUPPORT{support+=o.v}if o.k==ACTIVATION{activation+=o.v}}let coverage=(c[id].special_duration/ch.duration).min(1.);ss+=support*coverage;sa+=activation*coverage;}(ss,sa)}
fn special_bounds(x:&Ctx,ch:&Chart,c:&[Card])->(I,I){let(ss,sa)=special_raw(x,ch,c);(iz(ss),iz(sa))}
fn scale_i(source:I,scale:f64)->I{ir(source.l*scale/1000.,source.c*scale/1000.,source.u*scale/1000.)}
fn score_bounds(x:&Ctx,l:&Leader,ch:&Chart,c:&[Card])->(I,I,I,I,I){let(mp,ms)=memb_bounds(x,c);let(lp,ls)=lead_bounds(l,x,c);let(ss,sa)=special_raw(x,ch,c);let supports=[iar(ms[0],ls[0]),iar(ms[1],ls[1]),iar(ms[2],ls[2]),iar(ms[3],ls[3]),iar(ms[4],ls[4])];let base_active=active_bounds(x,ch,c,&supports,0.,0.,false);let support_active=active_bounds(x,ch,c,&supports,ss,0.,true);let all_active=active_bounds(x,ch,c,&supports,ss,sa,true);let score_special=ir(0.,(support_active.c-base_active.c).max(0.),(support_active.c-base_active.c).max(support_active.u-base_active.u));let activation_special=ir(0.,(all_active.c-support_active.c).max(0.),(all_active.c-support_active.c).max(all_active.u-support_active.u));let special=ir(0.,(all_active.c-base_active.c).max(0.),(all_active.c-base_active.c).max(all_active.u-base_active.u));let _=score_special;let _=activation_special;let active_units=scale_i(base_active, x.base);let special_units=scale_i(special, x.base);let parameter_units=iar(lp,mp);let result=ir(x.base+parameter_units.l+active_units.l+special_units.l,x.base+parameter_units.c+active_units.c+special_units.c,x.base+parameter_units.u+active_units.u+special_units.u);(result,base_active,support_active,special,all_active)}
fn ctx(ids:[usize;5],c:&[Card])->Ctx{let(mut a,mut b)=([0;3],0.);for &i in &ids{a[c[i].attr as usize]+=1;b+=c[i].p.iter().sum::<f64>()}Ctx{ids,attrs:a,base:b}}
#[derive(Clone)]struct Win{score:f64,l:usize,ids:[usize;5],count:u64}
// JavaScript Math.round rounds negative half units toward positive infinity;
// Rust f64::round rounds them away from zero. Keep the native boundary exact.
fn js_round(v:f64)->f64{(v+0.5).floor()}
fn micro(v:f64)->i64{js_round(v*1_000_000.)as i64}
fn round6(v:f64)->f64{js_round(v*1_000_000.)/1_000_000.}
fn better(a:&Win,b:&Win,k:&Kernel)->bool{let am=micro(a.score);let bm=micro(b.score);if am!=bm{return am>bm}let al=&k.leaders[a.l].id;let bl=&k.leaders[b.l].id;if al!=bl{return al<bl}let ak=a.ids.iter().map(|i|k.cards[*i].id.as_str()).collect::<Vec<_>>().join("|");let bk=b.ids.iter().map(|i|k.cards[*i].id.as_str()).collect::<Vec<_>>().join("|");ak<bk}
fn rec(k:&Kernel,g:&[Vec<usize>],i:usize,n:usize,stars:usize,ids:&mut Vec<usize>,best:&mut Win,limit:usize){if n==0{best.count+=1;let mut t=[0;5];t.copy_from_slice(ids);t.sort_unstable();let x=ctx(t,&k.cards);let(mp,ms)=memb(&x,&k.cards);let(mut ss,mut sa)=(0.,0.);for &id in &x.ids{let(s,a)=specials(&k.cards[id],&x,&k.cards);for ch in k.charts.iter().take(limit){ss+=s*k.cards[id].special_duration/ch.duration/limit as f64;sa+=a*k.cards[id].special_duration/ch.duration/limit as f64}}let(mut bs,mut bl)=(f64::NEG_INFINITY,0);for(li,l)in k.leaders.iter().enumerate(){let mut z=0.;for ch in k.charts.iter().take(limit){z+=score(&x,l,ch,&k.cards,mp,&ms,ss,sa)}z/=limit as f64;if z>bs{bs=z;bl=li}}let w=Win{score:bs,l:bl,ids:t,count:best.count};if best.score.is_infinite()||better(&w,best,k){*best=w}return}if i>=g.len()||g.len()-i<n{return}rec(k,g,i+1,n,stars,ids,best,limit);for &id in &g[i]{let s=stars+(k.cards[id].rarity==5)as usize;if s<=5{ids.push(id);rec(k,g,i+1,n-1,s,ids,best,limit);ids.pop();}}}
#[allow(non_snake_case)]#[derive(Deserialize)]struct ParityCase{caseId:usize,leaderCardId:String,memberCardIds:Vec<String>,chartKey:String,investmentLayer:String,bloomStages:std::collections::HashMap<String,u8>}
// Keep singer relationships in the generated kernel; this prototype does not
// yet apply an undocumented singer-specific rule, but it must not discard the
// pinned fact while parity cases are evaluated.
fn effective_card(card:&Card,case:&ParityCase)->Card{let key=case.bloomStages.get(&card.id).map(|stage|format!("bloom{}",stage)).unwrap_or_else(||match case.investmentLayer.as_str(){"low-investment"=>"low".into(),"duplicate-enabled-ceiling"=>"ceiling".into(),_=>"one".into()});let progression=card.progressions.get(&key).unwrap_or_else(||panic!("missing progression {} for {}",key,card.id));let mut copy=card.clone();copy.p=progression.p;copy.passive=progression.passive.clone();copy.active=progression.active.clone();copy.special=progression.special.clone();copy.cooldown=progression.cooldown;copy.duration=progression.duration;copy.probability=progression.probability;copy.special_duration=progression.special_duration;copy}
fn parity(k:&Kernel,path:&str){let cases:Vec<ParityCase>=serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();for case in cases{if case.memberCardIds.len()!=5{panic!("case {} is not a five-Member formation",case.caseId)}let effective_cards:Vec<Card>=k.cards.iter().map(|card|effective_card(card,&case)).collect();let mut ids=[0;5];for(i,id)in case.memberCardIds.iter().enumerate(){ids[i]=effective_cards.iter().position(|card|card.id==*id).unwrap();}let leader=k.leaders.iter().find(|leader|leader.id==case.leaderCardId).unwrap();let chart=k.charts.iter().find(|chart|chart.key==case.chartKey).unwrap();let x=ctx(ids,&effective_cards);let(mp,ms)=memb(&x,&effective_cards);let(lp,ls)=lead(leader,&x,&effective_cards);let(mut ss,mut sa)=(0.,0.);for &id in &x.ids{let(s,a)=specials(&effective_cards[id],&x,&effective_cards);let coverage=(effective_cards[id].special_duration/chart.duration).min(1.);ss+=s*coverage;sa+=a*coverage;}let mut total=0.;for n in 0..chart.noteCount{let at=(n as f64+0.5)*chart.duration/chart.noteCount as f64;let mut v=[(0.,0.);5];for i in 0..5{let q=&effective_cards[x.ids[i]];let last=(at/q.cooldown).floor()as i64;let first=(((at-q.duration)/q.cooldown).floor()as i64+1).max(1);let checks=if last>=first{(last-first+1)as usize}else{0};v[i]=(active(q,&x,&effective_cards,n+1)*(1000.+ms[i]+ls[i]+ss)/1000.,prob(checks,q.probability,sa));}total+=emax(&mut v);}let(sb,ab)=special_bounds(&x,chart,&effective_cards);let(bounds,base_active,support_active,special,all_active)=score_bounds(&x,leader,chart,&effective_cards);println!("{{\"caseId\":{},\"lowerMicroUnits\":{},\"centralMicroUnits\":{},\"upperMicroUnits\":{},\"specialBoundSupportPermil\":{:.9},\"specialBoundActivationPermil\":{:.9},\"baseActivePermil\":{:.9},\"supportActivePermil\":{:.9},\"allActivePermil\":{:.9},\"specialPermil\":{:.9},\"baseUnits\":{:.9},\"memberParameterUnits\":{:.9},\"leaderParameterUnits\":{:.9},\"activeAverageUpPermil\":{:.9},\"specialSupportPermil\":{:.9},\"specialActivationRateUpPermil\":{:.9}}}",case.caseId,micro(bounds.l),micro(bounds.c),micro(bounds.u),sb.c,ab.c,base_active.c,support_active.c,all_active.c,special.c,x.base,mp,lp,total/chart.noteCount as f64,ss,sa);}}
fn main(){let mut args=env::args().skip(1);let path=args.next().unwrap_or("tools/exact-global-solver/kernel.json".into());let parity_path=args.next();let mut k:Kernel=serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();if let Some(cases)=parity_path{parity(&k,&cases);return}let mut seen=std::collections::HashSet::new();k.leaders.retain(|l|{let key=l.applications.iter().map(|o|format!("{}:{}:{}:{}:{}:{}:{}:{}:{}:{}:{}:{}",o.h,o.c,o.k,o.v,o.t,o.a,o.g,o.n,o.r,o.q,o.ra,o.rg)).collect::<Vec<_>>().join("|");seen.insert(key)});let limit:usize=env::var("YD_CHART_LIMIT").ok().and_then(|x|x.parse().ok()).unwrap_or(k.charts.len());let mut m=std::collections::HashMap::<String,Vec<usize>>::new();for(i,c)in k.cards.iter().enumerate(){m.entry(c.talent.clone()).or_default().push(i)}let mut g:Vec<Vec<usize>>=m.into_values().collect();g.sort_by_key(|x|x[0]);let(mut ids,mut best)=(Vec::new(),Win{score:f64::NEG_INFINITY,l:0,ids:[0;5],count:0});rec(&k,&g,0,5,0,&mut ids,&mut best,limit);println!("{{\"kind\":\"exact-global-search-prototype\",\"certificateEligible\":false,\"charts\":{},\"leaderClasses\":{},\"bestCentralUtility\":{:.6},\"leaderCardId\":\"{}\",\"memberCardIds\":[{}],\"legalTeamSetsEnumerated\":{}}}",limit,k.leaders.len(),best.score,k.leaders[best.l].id,best.ids.iter().map(|i|format!("\"{}\"",k.cards[*i].id)).collect::<Vec<_>>().join(","),best.count)}

#[cfg(test)]
mod tests {
    use super::*;

    fn op(trigger: u8, threshold: f64, target: u8, count: u8, combination: u8, effect: u8, value: f64) -> Op {
        Op { h: 1, c: combination, k: effect, v: value, t: target, a: 0, g: 1, n: count, r: trigger, q: threshold, ra: 0, rg: 1 }
    }

    fn card(index: usize, attr: u8, groups: u32) -> Card {
        Card {
            id: format!("fixture-{index}"),
            talent: format!("talent-{index}"),
            rarity: 5,
            attr,
            groups,
            p: [100., 100., 100.],
            passive: Vec::new(),
            active: Vec::new(),
            special: Vec::new(),
            cooldown: 10.,
            duration: 5.,
            probability: 500.,
            special_duration: 10.,
            progressions: std::collections::HashMap::new(),
        }
    }

    #[test]
    fn trigger_families_have_passing_and_failing_states() {
        let cards = vec![card(0, 0, 1), card(1, 0, 1), card(2, 1, 2), card(3, 2, 4), card(4, 2, 4)];
        let context = Ctx { ids: [0, 1, 2, 3, 4], attrs: [2, 1, 2], base: 500. };
        assert!(trig(&op(1, 2., 1, 0, 1, SCORE, 10.), &context, &cards, Some(2)));
        assert!(!trig(&op(1, 3., 1, 0, 1, SCORE, 10.), &context, &cards, Some(2)));
        assert!(trig(&op(2, 2., 1, 0, 1, SCORE, 10.), &context, &cards, Some(2)));
        assert!(!trig(&op(2, 3., 1, 0, 1, SCORE, 10.), &context, &cards, Some(2)));
        assert!(trig(&op(3, 2., 1, 0, 1, SCORE, 10.), &context, &cards, Some(2)));
        assert!(!trig(&op(3, 3., 1, 0, 1, SCORE, 10.), &context, &cards, Some(2)));
        assert!(trig(&op(4, 1000., 1, 0, 1, SCORE, 10.), &context, &cards, Some(2)));
        assert!(!trig(&op(4, 1001., 1, 0, 1, SCORE, 10.), &context, &cards, Some(2)));
    }

    #[test]
    fn target_selectors_and_caps_enumerate_without_fallbacks() {
        let cards = vec![card(0, 0, 1), card(1, 0, 1), card(2, 1, 2), card(3, 2, 4), card(4, 2, 4)];
        let context = Ctx { ids: [0, 1, 2, 3, 4], attrs: [2, 1, 2], base: 500. };
        let all = targets(&op(0, 0., 1, 0, 1, SCORE, 10.), None, &context, &cards);
        let self_target = targets(&op(0, 0., 2, 0, 1, SCORE, 10.), Some(2), &context, &cards);
        let capped = targets(&op(0, 0., 3, 1, 1, SCORE, 10.), None, &context, &cards);
        let group = targets(&op(0, 0., 4, 1, 1, SCORE, 10.), None, &context, &cards);
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].len(), 5);
        assert_eq!(self_target, vec![vec![2]]);
        assert_eq!(capped.len(), 2);
        assert_eq!(group.len(), 2);
    }

    #[test]
    fn active_combination_and_canonical_rounding_are_deterministic() {
        let mut active_cards = vec![card(0, 0, 1), card(1, 1, 2), card(2, 2, 4), card(3, 2, 4), card(4, 2, 4)];
        active_cards[0].active = vec![
            op(0, 0., 0, 0, 1, SCORE, 100.),
            op(0, 0., 0, 0, 2, SCORE, 250.),
        ];
        let context = Ctx { ids: [0, 1, 2, 3, 4], attrs: [1, 1, 3], base: 500. };
        assert_eq!(active(&active_cards[0], &context, &active_cards, 1), 250.);
        assert_eq!(micro(round6(1.0000005)), 1_000_001);
        assert_eq!(micro(round6(-0.0000005)), 0);
    }
}
