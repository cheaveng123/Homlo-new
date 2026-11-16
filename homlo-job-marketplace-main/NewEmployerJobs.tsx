import React,{useEffect,useMemo,useState} from 'react';
import {View,Text,Pressable,ActivityIndicator} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useLocalSearchParams,router} from 'expo-router';
import Animated,{FadeIn,FadeOut,LinearTransition,useSharedValue,useAnimatedStyle,useAnimatedScrollHandler,interpolate,Extrapolation} from 'react-native-reanimated';
import {c,f} from './NewTheme';
import {Icon,Circ,Chip,Sun,CountUp,JobRow,Boundary,Job} from './NewUI';
import {R,go} from './NewRoutes';
import {getEmployerById,getEmployerJobs} from '@/app/employer/[employerId]/employerRepository';
import type {JobListing} from '@/app/employer/[employerId]/types';

const FILTERS=['All','Part-time','Full-time','Weekends','Remote'];
function employmentLabel(t:JobListing['employmentType']){return ({'full-time':'Full-time','part-time':'Part-time','weekends':'Weekends','remote':'Remote'} as Record<string,string>)[t]??'Full-time'}
function dayLabel(p:string){if(/just now|h ago/.test(p))return 'Today';if(/yesterday/.test(p))return 'Yesterday';const m=p.match(/(\d+) days? ago/);return m?`${m[1]}d ago`:''}

function Screen(){
  const {employerId,id='1'}=useLocalSearchParams<{employerId?:string;id:string}>();
  const ins=useSafeAreaInsets();
  const [flt,setFlt]=useState('All');
  const [newest,setNewest]=useState(true);
  const [name,setName]=useState('this employer');
  const [jobs,setJobs]=useState<JobListing[]>([]);
  const [loading,setLoading]=useState(true);
  
  useEffect(()=>{
    let on=true;
    (async()=>{
      const eid=employerId||id;
      if(!eid){setLoading(false);return}
      const [e,j]=await Promise.all([getEmployerById(eid),getEmployerJobs(eid).catch(()=>[])]);
      if(!on)return;
      if(e)setName(e.name);
      setJobs(j);
      setLoading(false);
    })();
    return()=>{on=false};
  },[employerId,id]);
  
  const JOBS:Job[]=jobs.map(j=>({
    id:j.id,
    title:j.title,
    place:j.location.split(',')[0].trim(),
    type:employmentLabel(j.employmentType),
    pay:`$${j.price}/${j.priceUnit}`,
    day:dayLabel(j.postedAt)
  }));
  
  const y=useSharedValue(0);
  const tabsY=useSharedValue(0);
  const onScroll=useAnimatedScrollHandler(e=>{y.value=e.contentOffset.y});
  
  const small=useAnimatedStyle(()=>({opacity:interpolate(y.value,[40,80],[0,1],Extrapolation.CLAMP)}));
  const tabsShift=useAnimatedStyle(()=>({transform:[{translateY:Math.max(0,y.value-tabsY.value)}]}));
  
  const rows=useMemo(()=>{
    const l=JOBS.filter(j=>flt==='All'||j.type===flt);
    return newest?l:[...l].reverse();
  },[JOBS,flt,newest]);
  
  const days=Array.from(new Set(rows.map(j=>j.day)));
  
  return (
    <View style={{flex:1,backgroundColor:'#fff'}}>
      {/* Top bar - absolute, outside ScrollView */}
      <View style={{
        position:'absolute',
        top:0,
        left:0,
        right:0,
        zIndex:50,
        flexDirection:'row',
        alignItems:'center',
        justifyContent:'space-between',
        paddingHorizontal:16,
        paddingTop:ins.top+8,
        paddingBottom:8,
        backgroundColor:'#fff'
      }}>
        <Circ n="back" label="Back" onPress={()=>router.back()}/>
        <Animated.Text numberOfLines={1} style={[{flex:1,textAlign:'center',fontFamily:f.hb,fontSize:16,color:c.deep,marginHorizontal:8},small]}>{name}</Animated.Text>
        <View style={{width:44}}/>
      </View>
      
      {/* ScrollView - all content inside */}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingTop:ins.top+60,paddingBottom:ins.bottom+24}}
      >
        {/* Large employer name - STICKS (always visible, no fade) */}
        <View style={{paddingHorizontal:16,paddingTop:8,paddingBottom:8,backgroundColor:'#fff'}}>
          <Text style={{fontFamily:f.h,fontSize:24,color:c.deep}}>{name}</Text>
        </View>
        
        {/* Filter chips - STICKY (animated to stick at top) */}
        <Animated.View
          onLayout={e=>{tabsY.value=e.nativeEvent.layout.y;}}
          style={[{backgroundColor:'#fff',zIndex:4,elevation:4,borderBottomWidth:1,borderBottomColor:'#F3F4F6'},tabsShift]}
        >
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{gap:8,paddingHorizontal:16,paddingVertical:8}}
          >
            {FILTERS.map(k=><Chip key={k} t={k} on={flt===k} icon={k==='Remote'?'globe':undefined} onPress={()=>setFlt(k)}/>)}
          </Animated.ScrollView>
        </Animated.View>
        
        {/* Jobs count + sort */}
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:16,marginTop:4}}>
          <Text style={{fontFamily:f.b,fontSize:13,color:c.mu}}><CountUp to={rows.length} style={{fontFamily:f.s,color:c.deep}}/> jobs</Text>
          <Pressable accessibilityRole="button" onPress={()=>setNewest(!newest)} style={{height:44,flexDirection:'row',alignItems:'center',gap:6}}>
            <Icon n="sort" s={20} color={c.deep}/>
            <Text style={{fontFamily:f.s,fontSize:13,color:c.deep}}>{newest?'Newest':'Oldest'}</Text>
          </Pressable>
        </View>
        
        {loading && <View style={{marginTop:24,alignSelf:'center'}}><ActivityIndicator size="small" color={c.teal}/></View>}
        
        {/* Jobs list */}
        <View>
          {days.map(d=>(
            <Animated.View key={d} layout={LinearTransition} entering={FadeIn} exiting={FadeOut}>
              <View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:16,paddingTop:12,paddingBottom:4}}>
                <Sun/>
                <Text style={{fontFamily:f.hb,fontSize:13,color:c.mu}}>{d}</Text>
              </View>
              {rows.filter(j=>j.day===d).map((j,i)=><JobRow key={j.id} j={j} i={i} onPress={()=>go(R.job(j.id))}/>)}
            </Animated.View>
          ))}
        </View>
        
        {rows.length===0&&!loading&&(
          <Animated.View entering={FadeIn} style={{alignItems:'center',padding:48,gap:12}}>
            <View style={{width:64,height:64,borderRadius:32,backgroundColor:c.tint,alignItems:'center',justifyContent:'center'}}>
              <Icon n="bag" color={c.deep}/>
            </View>
            <Text style={{fontFamily:f.m,fontSize:14,color:c.mu}}>No jobs match this filter</Text>
          </Animated.View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

export default function NewEmployerJobs(){
  console.log('NEW EmployerJobs mounted');
  return <Boundary><Screen/></Boundary>;
}