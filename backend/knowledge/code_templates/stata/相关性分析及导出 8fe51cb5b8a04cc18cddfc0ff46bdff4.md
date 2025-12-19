# 相关性分析及导出

```jsx
***相关性及结果导出
use 数据, clear
estpost correlate Liquidity Fin Lev Size ROA Top10 share,matrix
esttab using 表4.3相关性及其显著性结果.rtf, unstack not noobs compress nogap replace star(* 0.1 ** 0.05 *** 0.01) b(%9.4f)
```