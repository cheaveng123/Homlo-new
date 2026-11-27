// VIEW ALL JOBS (employer's active jobs). Filters: All, Part-time, Full-time, Weekends, Remote. Wire JOBS to your existing hook.
import React,{useMemo,useState} from 'react';
import {View,Text,Pressable} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useLocalSearchParams,router} from '@/lib/router';
import Animated,{FadeIn,FadeOut,LinearTransition,useSharedValue,useAnimatedStyle,useAnimatedScrollHandler,interpolate,Extrapolation,withTiming} from 'react-native-reanimated';
import {c,f} from './NewTheme';
import {Icon,Circ,Chip,Sun,CountUp,JobRow,Job} from './NewUI';
import {R,go} from './NewRoutes';

const FILTERS=['All','Part-time','Full-time','Weekends','Remote'];
const JOBS:Job[]=[ // TODO existing jobs hook
  {id:'j1',title:'Junior Web Developer',place:'Toul Kork',type:'Full-time',pay:'$150/mo',day:'Today'},
  {id:'j2',title:'Weekend Cashier',place:'Chamkar Mon',type:'Weekends',pay:'$2.2/hr',day:'Today'},
  {id:'j3',title:'Support Agent',place:'Remote',type:'Remote',pay:'$400/mo',day:'Yesterday',remote:true},
  {id:'j4',title:'Shop Assistant',place:'Toul Kork',type:'Part-time',pay:'$2.5/hr',day:'Yesterday'}];

export default function EmployerJobs(){
  const {id='1'}=useLocalSearchParams<{id:string}>();const ins=useSafeAreaInsets();
  const [flt,setFlt]=useState('All');const [newest,setNewest]=useState(true);
  const y=useSharedValue(0);const onScroll=useAnimatedScrollHandler(e=>{y.value=e.contentOffset.y});
  const big=useAnimatedStyle(()=>({opacity:interpolate(y.value,[0,50],[1,0],Extrapolation.CLAMP),transform:[{scale:interpolate(y.value,[0,50],[1,0.94],Extrapolation.CLAMP)}]}));
  const small=useAnimatedStyle(()=>({opacity:interpolate(y.value,[40,80],[0,1],Extrapolation.CLAMP)}));
  const rows=useMemo(()=>{const l=JOBS.filter(j=>flt==='All'||j.type===flt);return newest?l:[...l].reverse()},[flt,newest]);
  const days=[...new Set(rows.map(j=>j.day))];
  return <View style={{flex:1,backgroundColor:'#fff'}}>
    <View style={{paddingTop:ins.top+8,paddingHorizontal:16,paddingBottom:8,flexDirection:'row',alignItems:'center'}}><Circ n="back" label="Back" onPress={()=>router.back()}/>
      <Animated.Text numberOfLines={1} style={[{flex:1,textAlign:'center',fontFamily:f.hb,fontSize:16,color:c.deep},small]}>Jobs at Meng Cheaveng</Animated.Text><View style={{width:44}}/></View>
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:ins.bottom+24}}>
      <Animated.Text style={[{paddingHorizontal:16,paddingBottom:8,fontFamily:f.h,fontSize:24,color:c.deep},big]}>Jobs at Meng Cheaveng</Animated.Text>
      <View style={{backgroundColor:'#fff'}}><Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingHorizontal:16,paddingVertical:8}}>
        {FILTERS.map(k=><Chip key={k} t={k} on={flt===k} icon={k==='Remote'?'globe':undefined} onPress={()=>setFlt(k)}/>)}</Animated.ScrollView></View>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:16}}>
        <Text style={{fontFamily:f.b,fontSize:13,color:c.mu}}><CountUp to={rows.length} style={{fontFamily:f.s,color:c.deep}}/> jobs</Text>
        <Pressable accessibilityRole="button" onPress={()=>setNewest(!newest)} style={{height:44,flexDirection:'row',alignItems:'center',gap:6}}><Icon n="sort" s={20} color={c.deep}/><Text style={{fontFamily:f.s,fontSize:13,color:c.deep}}>{newest?'Newest':'Oldest'}</Text></Pressable></View>
      <View>{days.map(d=><Animated.View key={d} layout={LinearTransition} entering={FadeIn} exiting={FadeOut}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:16,paddingTop:12,paddingBottom:4}}><Sun/><Text style={{fontFamily:f.hb,fontSize:13,color:c.mu}}>{d}</Text></View>
        {rows.filter(j=>j.day===d).map((j,i)=><JobRow key={j.id} j={j} i={i} onPress={()=>go(R.job(j.id))}/>)}</Animated.View>)}</View>
      {rows.length===0&&<Animated.View entering={FadeIn} style={{alignItems:'center',padding:48,gap:12}}><View style={{width:64,height:64,borderRadius:32,backgroundColor:c.tint,alignItems:'center',justifyContent:'center'}}><Icon n="bag" color={c.deep}/></View><Text style={{fontFamily:f.m,fontSize:14,color:c.mu}}>No jobs match this filter</Text></Animated.View>}
    </Animated.ScrollView></View>;
}
