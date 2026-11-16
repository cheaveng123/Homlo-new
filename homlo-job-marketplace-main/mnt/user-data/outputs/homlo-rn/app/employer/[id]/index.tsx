// EMPLOYER PROFILE (second-person view). Wire EMP / JOBS / REVIEWS to your existing hooks.
import React,{useEffect,useState} from 'react';
import {View,Text,Image,Pressable} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useLocalSearchParams,router} from 'expo-router';
import Animated,{FadeInDown,SlideInDown,ZoomIn,useSharedValue,useAnimatedStyle,useAnimatedScrollHandler,withTiming,withDelay,withSequence,withSpring,interpolate,Extrapolation} from 'react-native-reanimated';
import {c,f,sh} from '../../../src/theme';
import {Icon,Circ,Btn,Sec,Reveal,Acc,CountUp,JobRow,Job} from '../../../src/ui';
import {R,go} from '../../../src/routes';

const EMP={name:'Meng Cheaveng',verified:true,industry:'Technology',place:'Toul Kork',jobs:26,rating:4.8,years:2,reviews:31,resp:'Within a day',initials:'MC',
  about:'A product-led technology team based in Toul Kork, building web and mobile tools for local businesses. We regularly hire interns and junior developers and offer mentorship, flexible schedules, and a clear path to full-time roles.',
  banner:undefined as string|undefined,photo:undefined as string|undefined}; // TODO existing employer hook
const JOBS:Job[]=[{id:'j1',title:'Junior Web Developer (Internship)',place:'Toul Kork',type:'Full-time',pay:'$150/mo',day:'Today'},{id:'j2',title:'Weekend Cashier',place:'Toul Kork',type:'Weekends',pay:'$2.2/hr',day:'Today'}];
const DIST=[84,12,4,0,0];
const REVIEWS=[{n:'Sophea',s:5,t:'Clear instructions and paid on time.',d:'1w ago'},{n:'Dara',s:4,t:'Friendly team, flexible schedule.',d:'3w ago'}]; // TODO existing reviews hook

// Stat strip (replaces the icon discs): big count-up numbers, each with its own tiny animated visual.
function Stars({v,size=16}:{v:number;size?:number}){
  const w=useSharedValue(0);useEffect(()=>{w.value=withDelay(300,withTiming(v/5,{duration:900}))},[v]);
  const a=useAnimatedStyle(()=>({width:`${w.value*100}%`}));const row=(col:string)=><View style={{flexDirection:'row'}}>{[0,1,2,3,4].map(i=><Icon key={i} n="star" s={size} color={col} fill/>)}</View>;
  return <View style={{width:size*5}}>{row(c.track)}<Animated.View style={[{position:'absolute',overflow:'hidden'},a]}>{row(c.sun)}</Animated.View></View>;
}
function Dot({i,on}:{i:number;on:boolean}){return <Animated.View entering={ZoomIn.delay(400+i*90)} style={{width:8,height:8,borderRadius:4,backgroundColor:on?c.sun:c.track}}/>}
function MiniBar({i}:{i:number}){const h=useSharedValue(0);useEffect(()=>{h.value=withDelay(400+i*90,withTiming(1,{duration:450}))},[]);
  const a=useAnimatedStyle(()=>({height:`${h.value*(30+i*17)}%`}));return <Animated.View style={[{width:5,borderRadius:3,backgroundColor:c.teal},a]}/>}
function Stat({label,children,vis}:{label:string;children:React.ReactNode;vis:React.ReactNode}){
  return <View style={{flex:1,alignItems:'center',paddingVertical:14,gap:6}}>{children}<View style={{height:18,justifyContent:'flex-end',alignItems:'center',flexDirection:'row',gap:4}}>{vis}</View><Text style={{fontFamily:f.b,fontSize:12,color:c.mu}}>{label}</Text></View>;
}
function RateStar({on,onPress}:{on:boolean;onPress:()=>void}){
  const k=useSharedValue(1);const a=useAnimatedStyle(()=>({transform:[{scale:k.value}]}));
  return <Pressable accessibilityRole="button" accessibilityLabel="Rate" onPress={()=>{k.value=withSequence(withTiming(1.35,{duration:110}),withSpring(1));onPress()}} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Animated.View style={a}><Icon n="star" s={28} fill color={on?c.sun:c.track}/></Animated.View></Pressable>;
}
function DistBar({v,i}:{v:number;i:number}){const w=useSharedValue(0);useEffect(()=>{w.value=withDelay(300+i*80,withTiming(v,{duration:700}))},[v]);const a=useAnimatedStyle(()=>({width:`${w.value}%`}));
  return <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={{fontFamily:f.b,fontSize:12,color:c.mu,width:10}}>{5-i}</Text><View style={{flex:1,height:6,borderRadius:6,backgroundColor:c.track,overflow:'hidden'}}><Animated.View style={[{height:6,backgroundColor:c.teal,borderRadius:6},a]}/></View></View>;}

export default function EmployerProfile(){
  const {id='1'}=useLocalSearchParams<{id:string}>();const ins=useSafeAreaInsets();const [mine,setMine]=useState(0);
  const y=useSharedValue(0);const onScroll=useAnimatedScrollHandler(e=>{y.value=e.contentOffset.y});
  const ban=useAnimatedStyle(()=>({transform:[{translateY:interpolate(y.value,[-150,0,200],[-60,0,80],Extrapolation.CLAMP)},{scale:interpolate(y.value,[-150,0],[1.5,1],Extrapolation.CLAMP)}]}));
  const row=(ic:any,l:string,v:string)=><View style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:52,borderTopWidth:l==='Location'?0:1,borderColor:c.line}}><Icon n={ic} color={c.teal}/><Text style={{flex:1,fontFamily:f.b,fontSize:14,color:c.mu}}>{l}</Text><Text style={{fontFamily:f.s,fontSize:14,color:c.tx}}>{v}</Text></View>;
  return <View style={{flex:1,backgroundColor:'#fff'}}>
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:ins.bottom+110}}>
      <View style={{height:190+ins.top,overflow:'hidden',backgroundColor:c.deep}}>
        <Animated.View style={[{flex:1},ban]}>{EMP.banner?<Image source={{uri:EMP.banner}} style={{flex:1}}/>:<LinearGradient colors={[c.deep,c.teal]} start={{x:0,y:0}} end={{x:1,y:1}} style={{flex:1}}/>}</Animated.View>
        <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)','#fff']} locations={[0.3,1]} style={{position:'absolute',left:0,right:0,top:0,bottom:0}}/></View>
      <Animated.View entering={ZoomIn.springify().delay(150)} style={[{width:96,height:96,borderRadius:24,marginTop:-56,marginLeft:16,backgroundColor:c.dusk,borderWidth:4,borderColor:'#fff',alignItems:'center',justifyContent:'center',overflow:'hidden'},sh]}>
        {EMP.photo?<Image source={{uri:EMP.photo}} style={{width:'100%',height:'100%'}}/>:<Text style={{fontFamily:f.h,fontSize:28,color:'#fff'}}>{EMP.initials}</Text>}</Animated.View>
      <Reveal i={1} style={{paddingHorizontal:16,paddingTop:12}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={{fontFamily:f.h,fontSize:24,color:c.deep}}>{EMP.name}</Text>{EMP.verified&&<Icon n="vf" s={22} color={c.teal}/>}</View>
        <Text style={{fontFamily:f.b,fontSize:14,color:c.mu}}>{EMP.industry} · {EMP.place}</Text></Reveal>
      <Reveal i={2} style={{flexDirection:'row',margin:16,borderRadius:20,backgroundColor:c.bg}}>
        <Stat label="Active jobs" vis={[0,1,2,3,4].map(i=><MiniBar key={i} i={i}/>)}><CountUp to={EMP.jobs} style={{fontFamily:f.h,fontSize:24,color:c.deep}}/></Stat>
        <View style={{width:1,backgroundColor:c.line,marginVertical:14}}/>
        <Stat label="Rating" vis={<Stars v={EMP.rating}/>}><CountUp to={EMP.rating} dec={1} style={{fontFamily:f.h,fontSize:24,color:c.deep}}/></Stat>
        <View style={{width:1,backgroundColor:c.line,marginVertical:14}}/>
        <Stat label="On Homlo" vis={[0,1,2,3,4].map(i=><Dot key={i} i={i} on={i<EMP.years}/>)}><View style={{flexDirection:'row',alignItems:'baseline'}}><CountUp to={EMP.years} style={{fontFamily:f.h,fontSize:24,color:c.deep}}/><Text style={{fontFamily:f.s,fontSize:14,color:c.deep}}>yr</Text></View></Stat></Reveal>
      <Acc title="About the employer"><Text style={{fontFamily:f.b,fontSize:14,lineHeight:22,color:c.mu}}>{EMP.about}</Text></Acc>
      <Reveal i={3} style={{margin:16,paddingHorizontal:16,borderRadius:16,backgroundColor:c.bg}}>{row('pin','Location',EMP.place)}{row('bag','Industry',EMP.industry)}{row('clock','Response time',EMP.resp)}</Reveal>
      <View style={{paddingHorizontal:16,gap:12,marginBottom:8}}><Sec t="Reviews"/>
        <View style={{flexDirection:'row',alignItems:'center',gap:16,padding:16,borderRadius:20,backgroundColor:c.bg}}>
          <View style={{gap:4}}><CountUp to={EMP.rating} dec={1} style={{fontFamily:f.h,fontSize:40,color:c.deep}}/><Stars v={EMP.rating}/><Text style={{fontFamily:f.b,fontSize:12,color:c.mu}}>Based on {EMP.reviews} reviews</Text></View>
          <View style={{flex:1,gap:4}}>{DIST.map((v,i)=><DistBar key={i} v={v} i={i}/>)}</View></View>
        <View style={{padding:16,borderRadius:20,borderWidth:1,borderColor:c.line,alignItems:'center',gap:4}}><Text style={{fontFamily:f.s,fontSize:15,color:c.tx}}>Worked with them?</Text>
          <View style={{flexDirection:'row'}}>{[1,2,3,4,5].map(n=><RateStar key={n} on={n<=mine} onPress={()=>setMine(n)}/>)}</View>
          <View style={{alignSelf:'stretch'}}><Btn o t="Write a review" onPress={()=>{/* TODO existing review flow, pass rating=mine */}}/></View></View>
        {REVIEWS.map((r,i)=><Reveal key={i} i={i} style={{paddingVertical:12,borderTopWidth:1,borderColor:c.line,gap:6}}><View style={{flexDirection:'row',alignItems:'center',gap:12}}>
          <View style={{width:40,height:40,borderRadius:20,backgroundColor:c.cream,alignItems:'center',justifyContent:'center'}}><Text style={{fontFamily:f.h,color:c.ink}}>{r.n[0]}</Text></View>
          <View style={{flex:1}}><Text style={{fontFamily:f.s,fontSize:14,color:c.tx}}>{r.n}</Text><Stars v={r.s} size={14}/></View><Text style={{fontFamily:f.b,fontSize:12,color:c.mu}}>{r.d}</Text></View>
          <Text style={{fontFamily:f.b,fontSize:14,color:c.tx}}>{r.t}</Text></Reveal>)}</View>
      <View style={{paddingHorizontal:16,marginTop:8}}><Sec t="Active jobs from this employer"/></View>
      <View style={{margin:16,borderRadius:20,overflow:'hidden',borderWidth:1,borderColor:c.line}}>{JOBS.map((j,i)=><JobRow key={j.id} i={i} j={j} badge={EMP.initials} onPress={()=>go(R.job(j.id))}/>)}</View>
    </Animated.ScrollView>
    <View style={{position:'absolute',left:16,right:16,top:ins.top+8,flexDirection:'row',justifyContent:'space-between'}}><Circ n="back" label="Back" onPress={()=>router.back()}/><Circ n="more" label="More" onPress={()=>{/* TODO existing menu */}}/></View>
    <Animated.View entering={SlideInDown.delay(300).springify().damping(18)} style={{position:'absolute',left:0,right:0,bottom:0,flexDirection:'row',gap:8,padding:16,paddingBottom:ins.bottom+16,backgroundColor:'#fff',borderTopWidth:1,borderColor:c.line}}>
      <View style={{flex:1}}><Btn o icon="msg" t="Message" onPress={()=>go(R.chat(id))}/></View><View style={{flex:1.2}}><Btn t="View all jobs" onPress={()=>go(R.employerJobs(id))}/></View></Animated.View></View>;
}
