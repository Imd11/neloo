# 聚类分析

```jsx
cluster wardslinkage 人均地区生产总值元
cluster gen type1=group(3)
cluster dendrogram, cutnumber(13) ylabel(0(5000000000)20000000000, angle(horizontal))  yline(1190000000) scheme(s1mono)
```