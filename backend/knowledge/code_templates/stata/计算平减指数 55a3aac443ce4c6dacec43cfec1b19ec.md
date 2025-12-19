# 计算平减指数

数据：

| year | index_grp |
| --- | --- |
| 1991 | 109.2 |
| 1992 | 109.9 |
| 1993 | 106 |
| 1994 | 111 |
| 1995 | 104.2 |

代码：

```diff
g i=index_grp
replace i=index_grp*i[_n-1]/100 if year>1991
```