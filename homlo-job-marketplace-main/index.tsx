// JOB MANAGER. Keep your existing hooks: replace JOB / APPS with them. Layout, motion and links are the redesign.
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { ZoomIn, FadeInDown, FadeOut, LinearTransition, useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, withRepeat, withTiming, withDelay, interpolate, Extrapolation, useReducedMotion } from 'react-native-reanimated';
import { c, f, sh } from './NewTheme';
import { Icon, Circ, Btn, Pill, Sec, Reveal, Tabs } from './NewUI';
import { R, go } from './NewRoutes';

const JOB={title:'Cashier (Weekend)',place:'Chamkar Mon, Phnom Penh',views:0,pay:'$2.2',unit:'/hr',filled:1,total:4,unread:1}; // TODO existing job hook
const APPS=[{id:'a1',name:'Worker',when:'2w ago',status:'Accepted',answer:'"Worker\n\nYes"',loc:'Location not provided'}]; // TODO existing applications hook
const TABS=['All','Pending','Accepted','Rejected'];

function Seat({on,i}:{on:boolean;i:number}){
  const p=useSharedValue(0);const rm=useReducedMotion();
  useEffect(()=>{if(!rm)p.value=withDelay(900+i*150,withRepeat(withTiming(1,{duration:1400}),-1,true))},[i, p, rm]);
  const a=useAnimatedStyle(()=>({transform:[{scale:1+p.value*(on?0.04:0.06)}],borderColor:on?'#fff':`rgba(245,181,43,${0.25+p.value*0.6})`}));
  return <Animated.View entering={ZoomIn.delay(100+i*130).springify()} style={[{width:44,height:52,borderRadius:14,borderWidth:2,borderStyle:on?'solid':'dashed',alignItems:'center',justifyContent:'center',backgroundColor:on?'#fff':'transparent'},a]}><Icon n="user" color={on?c.teal:'rgba(255,255,255,0.5)'}/></Animated.View>;
}
function Bar({i,hot}:{i:number;hot:boolean}){
  const h=useSharedValue(0);useEffect(()=>{h.value=withDelay(300+i*100,withTiming(1,{duration:500}))},[h, i]);
  const a=useAnimatedStyle(()=>({height:`${h.value*(hot?100:10)}%`}));
  return <Animated.View style={[{flex:1,borderRadius:3,backgroundColor:hot?c.teal:c.track},a]}/>;
}
function Bars({hot}:{n?:number;hot?:boolean}){
  return <View style={{flexDirection:'row',alignItems:'flex-end',gap:3,height:20,marginTop:8}}>{[0,1,2,3].map(i=><Bar key={i} i={i} hot={!!hot&&i===3}/>)}</View>;
}
function Tile({label,children,bg='#fff',bd=c.line,lc=c.mu}:{label:string;children:React.ReactNode;bg?:string;bd?:string;lc?:string}){
  return <View style={{flex:1,borderRadius:20,padding:14,backgroundColor:bg,borderWidth:1,borderColor:bd}}><Text style={{fontFamily:f.m,fontSize:12,color:lc}}>{label}</Text>{children}</View>;
}
export default function JobManager(){
  const {id='1'}=useLocalSearchParams<{id:string}>();const ins=useSafeAreaInsets();
  const [tab,setTab]=useState('All');const y=useSharedValue(0);
  const onScroll=useAnimatedScrollHandler(e=>{y.value=e.contentOffset.y});
  const big=useAnimatedStyle(()=>({opacity:interpolate(y.value,[0,70],[1,0],Extrapolation.CLAMP),transform:[{translateY:interpolate(y.value,[0,70],[0,-10],Extrapolation.CLAMP)}]}));
  const small=useAnimatedStyle(()=>({opacity:interpolate(y.value,[60,100],[0,1],Extrapolation.CLAMP)}));
  const glow=useSharedValue(0);const rm=useReducedMotion();useEffect(()=>{if(!rm)glow.value=withRepeat(withTiming(1,{duration:1200}),-1,true)},[glow, rm]);
  const bolt=useAnimatedStyle(()=>({shadowColor:c.sun,shadowOpacity:0.3+glow.value*0.5,shadowRadius:4+glow.value*8,shadowOffset:{width:0,height:0},elevation:2}));
  const shown=APPS.filter(a=>tab==='All'||a.status===tab);
  return <View style={{flex:1,backgroundColor:'#fff'}}>
    <View style={{paddingTop:ins.top+8,paddingHorizontal:16,paddingBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#fff'}}>
      <Circ n="back" label="Back" onPress={()=>router.back()}/>
      <Animated.Text numberOfLines={1} style={[{flex:1,textAlign:'center',fontFamily:f.hb,fontSize:16,color:c.deep,marginHorizontal:8},small]}>{JOB.title}</Animated.Text>
      <Circ n="more" label="More" onPress={()=>{/* TODO existing menu; add "Edit job" there: go(R.editJob(id)) */}}/>
    </View>
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} stickyHeaderIndices={[4]} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:ins.bottom+24}}>
      <Animated.View style={[{paddingHorizontal:16},big]}><Text style={{fontFamily:f.h,fontSize:24,color:c.deep}}>{JOB.title}</Text>
        <Text style={{fontFamily:f.b,fontSize:13,color:c.mu,marginTop:4}}>{APPS.length} applicant · {JOB.unread} unread · {JOB.place}</Text></Animated.View>
      <Reveal i={1} style={{margin:16,gap:8}}>
        <View style={[{borderRadius:20,padding:14,backgroundColor:c.deep,flexDirection:'row',alignItems:'center'},sh]}>
          <View><Text style={{fontFamily:f.m,fontSize:12,color:c.tint2}}>Filled</Text><Text style={{fontFamily:f.h,fontSize:28,color:'#fff'}}>{JOB.filled} of {JOB.total}</Text></View>
          <View style={{flexDirection:'row',gap:8,marginLeft:'auto'}}>{Array.from({length:JOB.total},(_,i)=><Seat key={i} i={i} on={i<JOB.filled}/>)}</View></View>
        <View style={{flexDirection:'row',gap:8}}>
          <Tile label="Views"><Text style={{fontFamily:f.h,fontSize:22,color:c.deep}}>{JOB.views}</Text><Bars n={0}/></Tile>
          <Tile label="Applicants"><Text style={{fontFamily:f.h,fontSize:22,color:c.deep}}>{APPS.length}</Text><Bars n={1} hot/></Tile>
          <Tile label="Pay" bg={c.cream} bd={c.cream2} lc={c.ink}><Text style={{fontFamily:f.h,fontSize:22,color:c.clay}}>{JOB.pay}<Text style={{fontSize:12}}>{JOB.unit}</Text></Text></Tile></View>
      </Reveal>
      <Reveal i={2} style={{marginHorizontal:16,borderRadius:20,backgroundColor:c.cream,overflow:'hidden'}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12,padding:16}}><Animated.View style={[{width:44,height:44,borderRadius:22,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},bolt]}><Icon n="bolt" color={c.ink}/></Animated.View>
          <View><Text style={{fontFamily:f.hb,fontSize:16,color:c.ink}}>Boost job</Text><Text style={{fontFamily:f.b,fontSize:13,color:c.ink}}>Wider candidate exposure</Text></View></View>
        <View style={{borderTopWidth:2,borderStyle:'dashed',borderColor:c.cream2,marginHorizontal:16}}/>
        <View style={{padding:16}}><Btn shim t="Boost job" onPress={()=>go(R.boost(id))}/></View></Reveal>
      <Reveal i={3} style={{marginHorizontal:16,marginTop:12,marginBottom:24,flexDirection:'row',alignItems:'center',gap:12,padding:12,borderRadius:16,backgroundColor:c.bg}}>
        <View style={{width:44,height:44,borderRadius:22,backgroundColor:c.tint,alignItems:'center',justifyContent:'center'}}><Icon n="pin" color={c.deep}/></View>
        <View><Text style={{fontFamily:f.b,fontSize:12,color:c.mu}}>Location</Text><Text style={{fontFamily:f.m,fontSize:14,color:c.tx}}>{JOB.place}</Text></View></Reveal>
      <Tabs keys={TABS} v={tab} on={setTab}/>
      <View style={{padding:16,gap:12}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Sec t="Applications"/><View style={{marginLeft:'auto'}}><Pill t={String(shown.length)}/></View></View>
        {shown.map((a,i)=><Animated.View key={a.id} entering={FadeInDown.delay(i*80).duration(400)} exiting={FadeOut.duration(120)} layout={LinearTransition} style={{flexDirection:'row',gap:12}}>
          <View style={{width:16,alignItems:'center',paddingTop:20}}><View style={{width:12,height:12,borderRadius:6,backgroundColor:c.sun,borderWidth:4,borderColor:c.cream}}/><View style={{flex:1,width:2,backgroundColor:c.track,marginTop:6}}/></View>
          <View style={[{flex:1,borderWidth:1,borderColor:c.line,borderRadius:20,padding:16,backgroundColor:'#fff'},sh]}>
            <View style={{flexDirection:'row',alignItems:'center',gap:12}}><View style={{width:44,height:44,borderRadius:22,backgroundColor:c.tint,alignItems:'center',justifyContent:'center'}}><Text style={{fontFamily:f.h,fontSize:17,color:c.deep}}>{a.name[0]}</Text></View>
              <View style={{flex:1}}><Text style={{fontFamily:f.s,fontSize:15,color:c.tx}}>{a.name}</Text><Text style={{fontFamily:f.b,fontSize:13,color:c.mu}}>Applied {a.when}</Text></View><Pill t={a.status}/></View>
            <View style={{backgroundColor:c.bg,borderRadius:14,padding:12,marginVertical:12}}><Text style={{fontFamily:f.b,fontSize:14,color:c.tx}}>{a.answer}</Text></View>
            <Text style={{fontFamily:f.b,fontSize:13,color:c.mu,marginBottom:12}}>{a.loc}</Text>
            <Btn o icon="msg" t="Message" onPress={()=>go(R.thread(a.id, a.name, a.status))}/></View></Animated.View>)}
      </View>
    </Animated.ScrollView></View>;
}
