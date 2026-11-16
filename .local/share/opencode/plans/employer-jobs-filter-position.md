# Plan: Fix filter hotbar position on employer "View all jobs" page

## Problem
"the hotbar of the all, part time full time part it is detaiched and not position in the correct position" 
- Refers to the filter chips bar (All, Part-time, Full-time, Weekends, Remote) on the employer jobs list page
- Page is at `app/employer/[employerId]/jobs.tsx` which re-exports `NewEmployerJobs.tsx`

## Current structure in NewEmployerJobs.tsx
```tsx
<Animated.Text style={[{paddingHorizontal:16,paddingBottom:12,...},big]}>{name}</Animated.Text>
<Animated.View onLayout={e=>{tabY.value=e.nativeEvent.layout.y;K.value=tabY.value-headerH}} 
  style={[{backgroundColor:'#fff',zIndex:30,borderBottomWidth:1,borderBottomColor:'#F3F4F6',marginTop:4},tabsShift]}>
  <Animated.ScrollView horizontal ...>
    {FILTERS.map(k=><Chip key={k} t={k} on={flt===k} .../>)}
  </Animated.ScrollView>
</Animated.View>
<View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:16,marginTop:8}}>
  <Text>...jobs</Text>
  <Pressable>...</Pressable>
</View>
```
- Sticky behavior via animated translateY when scrolled past `tabY - headerH`, headerH = ins.top + 60
- Header bar at top: paddingTop ins.top+8, paddingBottom 8, contains back button + centered name + spacer (total height ~ins.top + 60)
- Issue: chips bar has `marginTop:4` making it look detached/hanging below the title
- Also the big title has `paddingBottom:12` creating extra gap

## Fixes
1. Remove or reduce `marginTop` on the tabs Animated.View (change from `marginTop:4` to `marginTop:0` or remove it)
2. Adjust title padding - change `paddingBottom:12` to `paddingBottom:8` or `0` to bring chips closer
3. Add small margin/padding to attach chips properly to the flow
4. May need to adjust the count/sort row marginTop - currently `marginTop:8` (line 44), if chips move up this might need adjustment
5. Also check sticky positioning - headerH = ins.top+60 needs to align correctly with the fixed header bar

Alternative approach: make the chips bar sit directly under the title with minimal gap, like `marginTop:0` and ensure it's visually attached.

Let me also check the header bar height again:
```tsx
<View style={{paddingTop:ins.top+8,paddingHorizontal:16,paddingBottom:8,flexDirection:'row',alignItems:'center',backgroundColor:'#fff',zIndex:30}}>
  <Circ n="back" label="Back" onPress={()=>router.back()}/>
  <Animated.Text ...>{name}</Animated.Text>
  <View style={{width:44}}/>
</View>
```
Circ is 44x44, so header content height ~44, plus vertical padding ~16, total ~60 + ins.top. Yes matches headerH.

Another issue - when not sticky, the chips are in normal flow. When sticky, they translate up. The "detached" look might be because of the borderBottom when sticky vs no border when not? They have `borderBottomWidth:1,borderBottomColor:'#F3F4F6'` always. Also backgroundColor white always.

Or maybe the issue is the chips are too far down - need to move them up closer to the title.
