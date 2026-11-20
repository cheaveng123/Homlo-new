import React,{useEffect,useState} from 'react';
import {View,Text,Image,Pressable} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useLocalSearchParams,router} from 'expo-router';
import {ReportSheet} from '@/components/legal/ReportSheet';
import Animated,{SlideInDown,ZoomIn,useSharedValue,useAnimatedStyle,useAnimatedScrollHandler,withTiming,withDelay,withSequence,interpolate,Extrapolation} from 'react-native-reanimated';
import {c,f,sh} from './NewTheme';
import {Icon,Circ,Btn,Sec,Reveal,Acc,CountUp,JobRow,Fade,Boundary,Job,IconName} from './NewUI';
import {R,go} from './NewRoutes';
import {getEmployerById,getEmployerJobsPreview,getEmployerReviews} from '@/app/employer/[employerId]/employerRepository';
import type {Employer,JobListing,Review} from '@/app/employer/[employerId]/types';
import {EmployerProfileSkeleton} from '@/src/new/components/NewSkeletons';
import {useFirstLoadSkeletonFlag} from '@/lib/useFirstLoadSkeletonFlag';

import { smooth } from '@/src/design/motion';
function initialsOf(name:string){return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()??'').join('')||'H'}
function employmentLabel(t:JobListing['employmentType']){return ({'full-time':'Full-time','part-time':'Part-time','weekends':'Weekends','remote':'Remote'} as Record<string,string>)[t]??'Full-time'}
function dayLabel(p:string){if(/just now|h ago/.test(p))return 'Today';if(/yesterday/.test(p))return 'Yesterday';const m=p.match(/(\d+) days? ago/);return m?`${m[1]}d ago`:''}

function Stars({v,size=16}:{v:number;size?:number}){
  const w=useSharedValue(0);useEffect(()=>{w.value=withDelay(300,withTiming(v/5,{duration:900}))},[v, w]);
  const a=useAnimatedStyle(()=>({width:size*5*w.value}));
  const row=(col:string)=><View style={{flexDirection:'row',width:size*5}}>{[0,1,2,3,4].map(i=><Icon key={i} n="star" s={size} color={col} fill/>)}</View>;
  return <View style={{width:size*5}}>{row(c.track)}<Animated.View style={[{position:'absolute',overflow:'hidden'},a]}>{row(c.sun)}</Animated.View></View>;
}
function Dot({i,on}:{i:number;on:boolean}){return <Animated.View entering={ZoomIn.delay(400+i*90)} style={{width:8,height:8,borderRadius:4,backgroundColor:on?c.sun:c.track}}/>}
function MiniBar({i}:{i:number}){const h=useSharedValue(0);useEffect(()=>{h.value=withDelay(400+i*90,withTiming(1,{duration:450}))},[h, i]);
  const a=useAnimatedStyle(()=>({height:18*h.value*(0.3+i*0.17)}));return <Animated.View style={[{width:5,borderRadius:3,backgroundColor:c.teal},a]}/>}
function Stat({label,children,vis}:{label:string;children:React.ReactNode;vis:React.ReactNode}){
  return <View style={{flex:1,alignItems:'center',paddingVertical:14,gap:6}}>{children}<View style={{height:18,justifyContent:'flex-end',alignItems:'flex-end',flexDirection:'row',gap:4}}>{vis}</View><Text style={{fontFamily:f.b,fontSize:12,color:c.mu}}>{label}</Text></View>;
}
const Line=({ic,l,v,first}:{ic:IconName;l:string;v:string;first?:boolean})=><View style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:52,borderTopWidth:first?0:1,borderColor:c.line}}><Icon n={ic} color={c.teal}/><Text style={{flex:1,fontFamily:f.b,fontSize:14,color:c.mu}}>{l}</Text><Text style={{fontFamily:f.s,fontSize:14,color:c.tx}}>{v}</Text></View>;

function Screen(){
  const {employerId,id='1'}=useLocalSearchParams<{employerId?:string;id:string}>();const ins=useSafeAreaInsets();
  const [reportOpen,setReportOpen]=useState(false);
  const [emp,setEmp]=useState<Employer|null>(null);const [jobs,setJobs]=useState<JobListing[]>([]);const [revs,setRevs]=useState<Review[]>([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{let on=true;(async()=>{
    const eid=employerId||id;if(!eid){setLoading(false);return}
    const [e,j,r]=await Promise.all([getEmployerById(eid),getEmployerJobsPreview(eid,3).catch(()=>[]),getEmployerReviews(eid).catch(()=>[])]);
    if(!on)return;setEmp(e);setJobs(j);setRevs(r);setLoading(false);
  })();return()=>{on=false}},[employerId,id]);
  const EMP=emp?{name:emp.name,verified:emp.verified,industry:emp.industry??emp.category,place:(emp.location||'Location to be confirmed').split(',').map(s=>s.trim()).slice(0,2).join(', '),
    jobs:emp.activeJobsCount,rating:emp.rating,years:Number(emp.yearsOnHomlo.match(/\d+/)?.[0]??0),reviews:emp.reviewCount,resp:emp.responseTime,initials:initialsOf(emp.name),about:emp.about,banner:emp.bannerUrl??undefined,photo:emp.avatarUrl??undefined}:null;
  const JOBS:Job[]=jobs.map(j=>({id:j.id,title:j.title,place:j.location.split(',')[0].trim(),type:employmentLabel(j.employmentType),pay:`$${j.price}/${j.priceUnit}`,day:dayLabel(j.postedAt)}));
  const REVIEWS=revs.map(r=>({n:r.authorName,s:r.rating,t:r.text,d:''}));
  const y=useSharedValue(0);const onScroll=useAnimatedScrollHandler(e=>{y.value=e.contentOffset.y});
  const ban=useAnimatedStyle(()=>({transform: [{translateY: interpolate(y.value,[-150,0,200],[-60,0,80],Extrapolation.CLAMP)}, {scale: interpolate(y.value,[-150,0],[1.5,1],Extrapolation.CLAMP)}] }));
  const showSkeleton=useFirstLoadSkeletonFlag({loading,data:emp??undefined});
  if(showSkeleton)return <View style={{flex:1,backgroundColor:'#fff'}}><EmployerProfileSkeleton topInset={ins.top}/></View>;
  if(!EMP)return <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#fff',padding:24,gap:14}}>
    <Text style={{fontFamily:f.b,fontSize:14,color:c.mu,textAlign:'center'}}>Employer not found</Text>
    <Btn o t="Back" onPress={()=>router.back()}/></View>;
  return <View style={{flex:1,backgroundColor:'#fff'}}>
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:ins.bottom+110}}>
      <View style={{height:190+ins.top,overflow:'hidden',backgroundColor:c.deep}}>
        <Animated.View style={[{flex:1,backgroundColor:c.teal},ban]}>{EMP.banner?<Image source={{uri:EMP.banner}} style={{flex:1}}/>:<View style={{flex:1,backgroundColor:c.deep,opacity:0.9}}/>}</Animated.View>
        <Fade h={120}/></View>
      <Animated.View entering={ZoomIn.delay(150)} style={[{width:96,height:96,borderRadius:24,marginTop:-56,marginLeft:16,backgroundColor:c.dusk,borderWidth:4,borderColor:'#fff',alignItems:'center',justifyContent:'center',overflow:'hidden'},sh]}>
        {EMP.photo?<Image source={{uri:EMP.photo}} style={{width:'100%',height:'100%'}}/>:<Text style={{fontFamily:f.h,fontSize:28,color:'#fff'}}>{EMP.initials}</Text>}</Animated.View>
      <Reveal i={1} style={{paddingHorizontal:16,paddingTop:12}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={{fontFamily:f.h,fontSize:24,color:c.deep}}>{EMP.name}</Text>{EMP.verified&&<Icon n="vf" s={22} color={c.teal}/>}</View>
        <Text style={{fontFamily:f.b,fontSize:14,color:c.mu}}>{EMP.industry} · {EMP.place}</Text></Reveal>
      <Reveal i={2} style={{flexDirection:'row',margin:16,borderRadius:20,backgroundColor:c.bg}}>
        <Stat label="Active jobs" vis={[0,1,2,3,4].map(i=><MiniBar key={i} i={i}/>)}><CountUp to={EMP.jobs} style={{fontFamily:f.h,fontSize:24,color:c.deep}}/></Stat>
        {/* App Store: no review system yet, so no rating is shown unless real reviews exist. */}
        {EMP.reviews>0&&<><View style={{width:1,backgroundColor:c.line,marginVertical:14}}/>
        <Stat label="Rating" vis={<Stars v={EMP.rating}/>}><CountUp to={EMP.rating} dec={1} style={{fontFamily:f.h,fontSize:24,color:c.deep}}/></Stat></>}
        <View style={{width:1,backgroundColor:c.line,marginVertical:14}}/>
        <Stat label="On Homlo" vis={[0,1,2,3,4].map(i=><Dot key={i} i={i} on={i<EMP.years}/>)}><View style={{flexDirection:'row',alignItems:'baseline'}}><CountUp to={EMP.years} style={{fontFamily:f.h,fontSize:24,color:c.deep}}/><Text style={{fontFamily:f.s,fontSize:14,color:c.deep}}>yr</Text></View></Stat></Reveal>
      <Acc title="About the employer"><Text style={{fontFamily:f.b,fontSize:14,lineHeight:22,color:c.mu}}>{EMP.about}</Text></Acc>
      <Reveal i={3} style={{margin:16,paddingHorizontal:16,borderRadius:16,backgroundColor:c.bg}}><Line first ic="pin" l="Location" v={EMP.place}/><Line ic="bag" l="Industry" v={EMP.industry}/>{!!EMP.resp&&<Line ic="clock" l="Response time" v={EMP.resp}/>}</Reveal>
      {/* Reviews only when real ones exist (the sample distribution and the
          non-functional "Write a review" box were removed for App Review). */}
      {REVIEWS.length>0&&<View style={{paddingHorizontal:16,gap:12,marginBottom:8}}><Sec t="Reviews"/>
        <View style={{flexDirection:'row',alignItems:'center',gap:16,padding:16,borderRadius:20,backgroundColor:c.bg}}>
          <View style={{gap:4}}><CountUp to={EMP.rating} dec={1} style={{fontFamily:f.h,fontSize:40,color:c.deep}}/><Stars v={EMP.rating}/><Text style={{fontFamily:f.b,fontSize:12,color:c.mu}}>Based on {EMP.reviews} reviews</Text></View>
          </View>
        <View>{REVIEWS.map((r,i)=><Reveal key={i} i={i} style={{paddingVertical:12,borderTopWidth:1,borderColor:c.line,gap:6}}><View style={{flexDirection:'row',alignItems:'center',gap:12}}>
          <View style={{width:40,height:40,borderRadius:20,backgroundColor:c.cream,alignItems:'center',justifyContent:'center'}}><Text style={{fontFamily:f.h,color:c.ink}}>{r.n[0]}</Text></View>
          <View style={{flex:1}}><Text style={{fontFamily:f.s,fontSize:14,color:c.tx}}>{r.n}</Text><Stars v={r.s} size={14}/></View>{r.d?<Text style={{fontFamily:f.b,fontSize:12,color:c.mu}}>{r.d}</Text>:null}</View>
          <Text style={{fontFamily:f.b,fontSize:14,color:c.tx}}>{r.t}</Text></Reveal>)}</View></View>}
      {/^[0-9a-f-]{36}$/i.test(String(employerId||id))&&<Pressable accessibilityRole="button" onPress={()=>setReportOpen(true)} style={{marginHorizontal:16,marginBottom:8,alignSelf:'flex-start',paddingVertical:8}}>
        <Text style={{fontFamily:f.s,fontSize:14,color:c.mu,textDecorationLine:'underline'}}>Report this profile</Text></Pressable>}
      <View style={{paddingHorizontal:16,marginTop:8}}><Sec t="Active jobs from this employer"/></View>
      <View style={{margin:16,borderRadius:20,overflow:'hidden',borderWidth:1,borderColor:c.line}}>{JOBS.map((j,i)=><JobRow key={j.id} i={i} j={j} badge={EMP.initials} onPress={()=>go(R.job(j.id))}/>)}</View>
    </Animated.ScrollView>
    <View style={{position:'absolute',left:16,right:16,top:ins.top+8,flexDirection:'row',justifyContent:'space-between'}}><Circ n="back" label="Back" onPress={()=>router.back()}/></View>
    <Animated.View entering={SlideInDown.delay(300)} style={{position:'absolute',left:0,right:0,bottom:0,flexDirection:'row',gap:8,padding:16,paddingBottom:ins.bottom+16,backgroundColor:'#fff',borderTopWidth:1,borderColor:c.line}}>
      <View style={{flex:1}}><Btn t="View all jobs" onPress={()=>go(R.employerJobs(employerId||id))}/></View></Animated.View>
    <ReportSheet visible={reportOpen} onClose={()=>setReportOpen(false)} targetType="user" targetId={String(employerId||id)} targetLabel={EMP.name}/></View>;
}
export default function NewEmployerProfile(){console.log('NEW EmployerProfile mounted');return <Boundary><Screen/></Boundary>}