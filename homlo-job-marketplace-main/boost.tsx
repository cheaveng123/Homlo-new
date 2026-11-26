// BOOST (step 1/3). DATA NOTE: the real app has MANY pricing options plus Pro prices, so everything below is data-driven.
// OPTS must come from your existing pricing source (any length; the ladder scrolls sideways when there are more than fit).
// Each stop on the ladder owns its card below: name, days, boosts, price, Pro price, perks. Choosing a stop changes the card and the price above.
// Never hard-code plan counts or prices in the UI. Steps 2/3 reuse the same step header with step=2|3.
import React,{useEffect,useRef,useState} from 'react';
import {View,Text,FlatList,ScrollView,Pressable,useWindowDimensions} from 'react-native';
import LinearGradient from '@/lib/native/linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useLocalSearchParams,router} from '@/lib/router';
import Animated,{FadeInDown,FadeOut,useSharedValue,useAnimatedStyle,withSpring,withTiming,withRepeat,withDelay,withSequence,Easing,useReducedMotion} from 'react-native-reanimated';
import {c,f,sh} from './NewTheme';
import {Icon,Circ,Btn,CountUp,Shimmer} from './NewUI';
import {R,go} from './NewRoutes';

type Opt={v:number;name:string;days:number;boosts:number;price:number;pro:number;rec?:boolean;perks:string[]};
const PERKS=['Priority placement in search and feeds','A Boosted badge on the listing','Wider candidate exposure','Views and applications reporting'];
const OPTS:Opt[]=[ // TODO: replace with the existing pricing data (same shape, any length)
  {v:3,name:'Starter',days:3,boosts:1,price:3.99,pro:2.99,perks:PERKS.slice(0,2)},
  {v:7,name:'Basic',days:5,boosts:1,price:6.99,pro:5.49,perks:PERKS.slice(0,3)},
  {v:10,name:'Standard',days:7,boosts:1,price:9.99,pro:7.99,rec:true,perks:PERKS},
  {v:15,name:'Plus',days:10,boosts:2,price:14.99,pro:11.99,perks:PERKS},
  {v:20,name:'Max',days:14,boosts:3,price:19.99,pro:15.99,perks:PERKS}];
const SW=72;

function Ring({d}:{d:number}){
  const p=useSharedValue(0);const rm=useReducedMotion();
  useEffect(()=>{if(!rm)p.value=withDelay(d,withRepeat(withTiming(1,{duration:3200,easing:Easing.out(Easing.quad)}),-1))},[]);
  const a=useAnimatedStyle(()=>({opacity:0.7*(1-p.value),transform:[{scale:0.45+p.value*1.05}]}));
  return <Animated.View style={[{position:'absolute',width:140,height:140,borderRadius:70,borderWidth:1.5,borderColor:c.teal},a]}/>;
}
function Steps({step}:{step:number}){
  return <View style={{flex:1,flexDirection:'row',gap:6}}>{[1,2,3].map(n=><StepBar key={n} on={n<=step}/>)}</View>;
}
function StepBar({on}:{on:boolean}){
  const w=useSharedValue(0);useEffect(()=>{w.value=withTiming(on?1:0,{duration:450})},[on]);
  const a=useAnimatedStyle(()=>({width:`${w.value*100}%`}));
  return <View style={{flex:1,height:4,borderRadius:4,backgroundColor:c.track,overflow:'hidden'}}><Animated.View style={[{height:4,backgroundColor:c.teal},a]}/></View>;
}
// Ladder: one thumb slides between stops with a stretch, the tick sits INSIDE the thumb, the track fills behind it.
function Ladder({idx,set}:{idx:number;set:(i:number)=>void}){
  const x=useSharedValue(idx*SW);const sx=useSharedValue(1);const prev=useRef(idx);
  useEffect(()=>{x.value=withSpring(idx*SW,{damping:16,stiffness:180});sx.value=withSequence(withTiming(1.5,{duration:110}),withSpring(1,{damping:10}));prev.current=idx},[idx]);
  const thumb=useAnimatedStyle(()=>({transform:[{translateX:x.value},{scaleX:sx.value}]}));
  const fill=useAnimatedStyle(()=>({width:x.value}));
  return <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{width:OPTS.length*SW,height:96}}>
    <View style={{position:'absolute',left:SW/2,width:(OPTS.length-1)*SW,top:50,height:3,borderRadius:3,backgroundColor:c.track}}/>
    <Animated.View style={[{position:'absolute',left:SW/2,top:50,height:3,borderRadius:3,backgroundColor:c.teal},fill]}/>
    {OPTS.map((o,i)=><Pressable key={o.v} accessibilityRole="radio" accessibilityState={{checked:i===idx}} onPress={()=>set(i)} style={{position:'absolute',left:i*SW,width:SW,height:96,alignItems:'center'}}>
      <Text style={{marginTop:6,fontFamily:i===idx?f.h:f.s,fontSize:14,color:i===idx?c.deep:c.mu}}>{o.v}</Text>
      <View style={{marginTop:36,width:10,height:10,borderRadius:5,backgroundColor:i<=idx?c.teal:c.tint2}}/>
      {o.rec&&<Text style={{position:'absolute',top:76,fontFamily:f.s,fontSize:12,color:c.clay}}>Recommended</Text>}</Pressable>)}
    <Animated.View pointerEvents="none" style={[{position:'absolute',left:SW/2-18,top:34,width:36,height:36,borderRadius:18,backgroundColor:'#fff',borderWidth:3,borderColor:c.teal,alignItems:'center',justifyContent:'center'},sh,thumb]}>
      <Icon n="chk" s={18} color={c.teal}/></Animated.View>
  </View></ScrollView>;
}
function Card({o,w}:{o:Opt;w:number}){
  return <View style={[{width:w,borderRadius:24,backgroundColor:c.cream,borderWidth:1,borderColor:c.cream2,overflow:'hidden'},sh]}>
    {o.rec&&<View style={{position:'absolute',top:0,right:0,backgroundColor:c.deep,paddingVertical:6,paddingHorizontal:14,borderBottomLeftRadius:16}}><Text style={{fontFamily:f.s,fontSize:12,color:'#fff'}}>Recommended</Text></View>}
    <View style={{flexDirection:'row',justifyContent:'space-between',padding:20,paddingBottom:16}}>
      <View><Text style={{fontFamily:f.h,fontSize:20,color:c.deep}}>{o.name}</Text><Text style={{fontFamily:f.b,fontSize:13,color:c.ink}}>{o.days} days · {o.boosts} boost{o.boosts>1?'s':''}</Text></View>
      <View style={{alignItems:'flex-end',marginTop:20}}><Text style={{fontFamily:f.h,fontSize:24,color:c.clay}}>${o.price.toFixed(2)}</Text><Text style={{fontFamily:f.b,fontSize:12,color:c.ink}}>Pro ${o.pro.toFixed(2)}</Text></View></View>
    <View style={{borderTopWidth:2,borderStyle:'dashed',borderColor:c.cream2,marginHorizontal:20}}/>
    <View style={{padding:20,gap:12}}>{o.perks.map(p=><View key={p} style={{flexDirection:'row',gap:12,alignItems:'center'}}><Icon n="chk" s={20} color={c.teal}/><Text style={{flex:1,fontFamily:f.b,fontSize:14,color:c.tx}}>{p}</Text></View>)}</View></View>;
}
export default function Boost(){
  const {id='1',step='1'}=useLocalSearchParams<{id:string;step?:string}>();const ins=useSafeAreaInsets();const {width}=useWindowDimensions();
  const CW=width-72,GAP=12;const [i,setI]=useState(Math.max(0,OPTS.findIndex(o=>o.rec)));const o=OPTS[i];
  const list=useRef<FlatList<Opt>>(null);const fromScroll=useRef(false);
  useEffect(()=>{if(fromScroll.current){fromScroll.current=false;return}list.current?.scrollToOffset({offset:i*(CW+GAP),animated:true})},[i]);
  return <LinearGradient colors={[c.tint,'#EAF6F5',c.bg]} style={{flex:1}}>
    <View style={{paddingTop:ins.top+8,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:12}}>
      <Circ n="back" label="Back" onPress={()=>router.back()}/><Steps step={Number(step)}/><Text style={{fontFamily:f.m,fontSize:13,color:c.mu}}>{step}/3</Text></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:24}}>
      <Animated.View entering={FadeInDown.duration(420)} style={{paddingHorizontal:16,paddingTop:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <View><Text style={{fontFamily:f.m,fontSize:13,color:c.mu}}>Boost budget</Text>
          <CountUp to={o.price} dec={2} pre="$" style={{fontFamily:f.h,fontSize:56,lineHeight:62,color:c.deep}}/>
          <Text style={{fontFamily:f.b,fontSize:14,color:c.mu}}><Text style={{fontFamily:f.s,color:c.deep}}>{o.name}</Text> · {o.days} days · Pro ${o.pro.toFixed(2)}</Text></View>
        <View style={{width:140,height:140,alignItems:'center',justifyContent:'center'}}><Ring d={0}/><Ring d={1050}/><Ring d={2100}/>
          {/* TODO: render your existing boost artwork here */}
          <View style={{width:68,height:84,borderRadius:16,backgroundColor:c.cream,borderWidth:2,borderStyle:'dashed',borderColor:c.cream2,alignItems:'center',justifyContent:'center',transform:[{rotate:'-5deg'}]}}><Icon n="bag" color={c.ink}/></View></View></Animated.View>
      <Animated.View entering={FadeInDown.delay(100).duration(420)} style={[{margin:16,padding:12,borderRadius:24,backgroundColor:'#fff',borderWidth:1,borderColor:c.line},sh]}><Ladder idx={i} set={setI}/></Animated.View>
      <FlatList ref={list} horizontal data={OPTS} keyExtractor={x=>String(x.v)} showsHorizontalScrollIndicator={false} snapToInterval={CW+GAP} decelerationRate="fast"
        contentOffset={{x:i*(CW+GAP),y:0}} contentContainerStyle={{paddingHorizontal:36,gap:GAP}}
        onMomentumScrollEnd={e=>{const n=Math.round(e.nativeEvent.contentOffset.x/(CW+GAP));if(n!==i){fromScroll.current=true;setI(n)}}}
        renderItem={({item,index})=><Animated.View style={{opacity:index===i?1:0.6,transform:[{scale:index===i?1:0.96}]}}><Card o={item} w={CW}/></Animated.View>}/>
    </ScrollView>
    <Animated.View entering={FadeInDown.delay(250)} style={{padding:16,paddingBottom:ins.bottom+16}}>
      <Btn shim t={`Continue · $${o.price.toFixed(2)}`} onPress={()=>go(R.boost(id,Math.min(3,Number(step)+1),String(o.v)))}/></Animated.View></LinearGradient>;
}
