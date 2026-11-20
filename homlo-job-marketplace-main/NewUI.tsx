import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeInDown, FadeIn, FadeOut, LinearTransition, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay, useReducedMotion, Easing } from 'react-native-reanimated';
import { c, f } from './NewTheme';

import { smooth } from '@/src/design/motion';
const ci=(x:number,y:number,r:number)=>`M${x-r} ${y}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0`;
const P={back:'M15 5l-7 7 7 7M8.5 12H20',more:ci(5,12,1)+ci(12,12,1)+ci(19,12,1),pin:'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z'+ci(12,10,2.3),
bag:'M6 7.5h12a2.5 2.5 0 012.5 2.5v7a2.5 2.5 0 01-2.5 2.5H6A2.5 2.5 0 013.5 17v-7A2.5 2.5 0 016 7.5zM9 7.5V6a2 2 0 012-2h2a2 2 0 012 2v1.5M3.5 13h17',
star:'M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16l-4.8 2.8 1-5.4-4-3.7 5.4-.7z',chk:'M5 12.5l4.5 4.5L19 7.5',vf:ci(12,12,8.5)+'M8.5 12.3l2.4 2.4 4.6-5',
msg:'M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v8a2.5 2.5 0 01-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 014 14.5z',bolt:'M13 3L5 13.5h6L10 21l8-10.5h-6z',dn:'M6 9.5l6 6 6-6',
sort:'M7 5v14M7 19l-3-3M7 19l3-3M17 19V5M17 5l-3 3M17 5l3 3',plus:'M12 5v14M5 12h14',minus:'M5 12h14',user:ci(12,8.5,3.5)+'M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5',
clock:ci(12,12,8.5)+'M12 7.5V12l3 2',img:'M6.5 4.5h11a3 3 0 013 3v9a3 3 0 01-3 3h-11a3 3 0 01-3-3v-9a3 3 0 013-3z'+ci(9,10,1.6)+'M4 17l5-4.5 4 3.5 3-2.5 4.5 3.5',
globe:ci(12,12,8.5)+'M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z'};
export type IconName=keyof typeof P;
export const Icon=({n,s=24,color=c.tx,fill=false}:{n:IconName;s?:number;color?:string;fill?:boolean})=>(
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={fill?color:'none'} stroke={fill?'none':color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d={P[n]}/></Svg>);

// Shows the error on screen instead of crashing, so you can read it and send it back.
export class Boundary extends React.Component<{children:React.ReactNode},{e?:Error}>{
  state={e:undefined as Error|undefined};
  static getDerivedStateFromError(e:Error){return {e}}
  render(){return this.state.e?<View style={{flex:1,padding:24,justifyContent:'center',backgroundColor:'#fff'}}><Text style={{fontSize:17,fontWeight:'700'}}>New screen error</Text><Text selectable style={{marginTop:8,color:c.clay}}>{String(this.state.e.message)}</Text></View>:this.props.children}
}
export function Press({children,onPress,style,label}:{children:React.ReactNode;onPress?:()=>void;style?:StyleProp<ViewStyle>;label?:string}){
  const k=useSharedValue(1);const a=useAnimatedStyle(()=>({transform:[{scale:k.value}]}));
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={()=>{k.set(smooth(0.975))}} onPressOut={()=>{k.set(smooth(1))}}><Animated.View style={[a,style]}>{children}</Animated.View></Pressable>;
}
export const Circ=({n,onPress,label}:{n:IconName;onPress?:()=>void;label:string})=>
  <Press label={label} onPress={onPress} style={{width:44,height:44,borderRadius:22,backgroundColor:'#fff',borderWidth:1,borderColor:c.line,alignItems:'center',justifyContent:'center'}}><Icon n={n}/></Press>;
// Light sweep (used on at most 3 buttons)
export function Shimmer({children}:{children:React.ReactNode}){
  const x=useSharedValue(-60);const rm=useReducedMotion();const [w,setW]=useState(300);
  useEffect(()=>{if(rm)return;x.value=-60;x.value=withRepeat(withSequence(withDelay(1800,withTiming(w+60,{duration:900,easing:Easing.inOut(Easing.quad)})),withTiming(-60,{duration:0})),-1)},[w, rm, x]);
  const a=useAnimatedStyle(()=>({transform:[{translateX:x.value}]}));
  return <View onLayout={e=>setW(e.nativeEvent.layout.width)} style={{borderRadius:999,overflow:'hidden'}}>{children}<Animated.View pointerEvents="none" style={[{position:'absolute',top:0,bottom:0,width:40,backgroundColor:'rgba(255,255,255,0.3)'},a]}/></View>;
}
export function Btn({t,onPress,o,shim,icon}:{t:string;onPress?:()=>void;o?:boolean;shim?:boolean;icon?:IconName}){
  const b=<Press onPress={onPress} style={{height:48,borderRadius:999,backgroundColor:o?'#fff':c.teal,borderWidth:o?1:0,borderColor:c.line,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingHorizontal:24}}>
    {icon&&<Icon n={icon} s={20} color={o?c.deep:'#fff'}/>}<Text style={{fontFamily:f.s,fontSize:15,color:o?c.deep:'#fff'}}>{t}</Text></Press>;
  return shim?<Shimmer>{b}</Shimmer>:b;
}
export const Pill=({t,clay}:{t:string;clay?:boolean})=><View style={{height:28,paddingHorizontal:12,borderRadius:999,backgroundColor:clay?c.clayT:c.tint,justifyContent:'center'}}><Text style={{fontFamily:f.s,fontSize:12,color:clay?c.clayI:c.deep}}>{t}</Text></View>;
export const Sun=()=><View style={{width:8,height:8,borderRadius:4,backgroundColor:c.sun}}/>;
export const Sec=({t}:{t:string})=><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Sun/><Text style={{fontFamily:f.hb,fontSize:17,color:c.tx}}>{t}</Text></View>;
export const Reveal=({i=0,children,style}:{i?:number;children:React.ReactNode;style?:StyleProp<ViewStyle>})=><Animated.View entering={FadeInDown.delay(i*70).duration(420)} style={style}>{children}</Animated.View>;
// Fake gradient to white (no extra package): stacked bands
export const Fade=({h=110}:{h?:number})=><View pointerEvents="none" style={{position:'absolute',left:0,right:0,bottom:0,height:h}}>{Array.from({length:8},(_,i)=><View key={i} style={{flex:1,backgroundColor:`rgba(255,255,255,${((i+1)/8)**1.5})`}}/>)}</View>;
export function Chip({t,on,onPress,icon}:{t:string;on:boolean;onPress:()=>void;icon?:IconName}){
  return <Press onPress={onPress} style={{height:44,paddingHorizontal:16,borderRadius:14,borderWidth:1,borderColor:on?c.deep:c.line,backgroundColor:on?c.deep:c.bg,flexDirection:'row',alignItems:'center',gap:6}}>
    {icon&&<Icon n={icon} s={18} color={on?'#fff':c.mu}/>}<Text style={{fontFamily:f.m,fontSize:14,color:on?'#fff':c.mu}}>{t}</Text></Press>;
}
export function Tabs({keys,v,on}:{keys:string[];v:string;on:(k:string)=>void}){
  const [w,setW]=useState(0);const x=useSharedValue(0);
  useEffect(()=>{x.value=smooth(keys.indexOf(v)*w)},[keys, v, w, x]);
  const a=useAnimatedStyle(()=>({transform:[{translateX:x.value}]}));
  return <View onLayout={e=>setW(e.nativeEvent.layout.width/keys.length)} style={{flexDirection:'row',backgroundColor:'#fff',borderBottomWidth:1,borderColor:c.line}}>
    {keys.map(k=><Pressable key={k} accessibilityRole="tab" onPress={()=>on(k)} style={{flex:1,height:48,alignItems:'center',justifyContent:'center'}}><Text style={{fontFamily:v===k?f.s:f.m,fontSize:14,color:v===k?c.deep:c.mu}}>{k}</Text></Pressable>)}
    <Animated.View style={[{position:'absolute',bottom:-1,height:3,width:w,backgroundColor:c.teal,borderRadius:3},a]}/></View>;
}
export function CountUp({to,dec=0,pre='',suf='',style}:{to:number;dec?:number;pre?:string;suf?:string;style?:any}){
  const [v,setV]=useState(0);const rm=useReducedMotion();
  useEffect(()=>{if(rm)return;let st=0,id=0;const run=(t:number)=>{if(!st)st=t;const p=Math.min(1,(t-st)/700);setV(to*(1-Math.pow(1-p,3)));if(p<1)id=requestAnimationFrame(run)};id=requestAnimationFrame(run);return()=>cancelAnimationFrame(id)},[to,rm]);
  // Reduce Motion: show the final number directly (no count-up).
  return <Text style={style}>{pre}{(rm?to:v).toFixed(dec)}{suf}</Text>;
}
export function Acc({title,children}:{title:string;children:React.ReactNode}){
  const [o,setO]=useState(true);const r=useSharedValue(1);useEffect(()=>{r.value=withTiming(o?1:0,{duration:250})},[o, r]);
  const a=useAnimatedStyle(()=>({transform:[{rotate:`${r.value*180}deg`}]}));
  return <Animated.View layout={LinearTransition.duration(250)} style={{marginHorizontal:16,borderWidth:1,borderColor:c.line,borderRadius:20,paddingHorizontal:16,overflow:'hidden'}}>
    <Pressable onPress={()=>setO(!o)} accessibilityRole="button" accessibilityState={{expanded:o}} style={{height:56,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{fontFamily:f.hb,fontSize:16,color:c.tx}}>{title}</Text><Animated.View style={a}><Icon n="dn"/></Animated.View></Pressable>
    {o&&<Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={{paddingBottom:16}}>{children}</Animated.View>}</Animated.View>;
}
export type Job={id:string;title:string;place:string;type:string;pay:string;day:string;remote?:boolean};
export function JobRow({j,onPress,badge,i=0}:{j:Job;onPress:()=>void;badge?:string;i?:number}){
  return <Animated.View entering={FadeInDown.delay(i*60).duration(380)} exiting={FadeOut.duration(120)} layout={LinearTransition.duration(260)}>
    <Press onPress={onPress} style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:12,minHeight:72,backgroundColor:'#fff'}}>
      <View style={{width:56,height:56,borderRadius:16,backgroundColor:c.tint,alignItems:'center',justifyContent:'center'}}><Icon n="bag" color={c.deep}/>
        {badge&&<View style={{position:'absolute',left:-6,top:-6,width:22,height:22,borderRadius:11,backgroundColor:c.dusk,borderWidth:2,borderColor:'#fff',alignItems:'center',justifyContent:'center'}}><Text style={{fontFamily:f.s,fontSize:9,color:'#fff'}}>{badge}</Text></View>}</View>
      <View style={{flex:1}}><Text numberOfLines={1} style={{fontFamily:f.s,fontSize:15,color:c.tx}}>{j.title}</Text><Text style={{fontFamily:f.b,fontSize:13,color:c.mu}}>{j.place} · {j.type}</Text></View>
      <Pill clay t={j.pay}/></Press></Animated.View>;
}
