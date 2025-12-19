# 异质性

```jsx
gen 地区=1 if provinces=="北京市"|provinces=="天津市"|provinces=="河北省"|provinces=="山东省"|provinces=="江苏省"|provinces=="上海市"|provinces=="浙江省"|provinces=="福建省"|provinces=="广东省"|provinces=="海南省"|provinces=="辽宁省"
replace 地区=2 if provinces=="山西省"|provinces=="安徽省"|provinces=="江西省"|provinces=="河南省"|provinces=="湖北省"|provinces=="湖南省"
replace 地区=3 if 地区==.
```