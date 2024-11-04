基本逻辑API会从从models，service，core找需要的内容。service只写逻辑，models设定参数，core则是各种需要key的部分。

所有的interface都在/models.py
所有api都在/api/
所有需要的function都在/service/
所有设定都在/core/