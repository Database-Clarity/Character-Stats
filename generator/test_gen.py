import unittest
from gen import getProperties, is_json, it_floats, is_int, returnIndexByName, returnIndexByHash

class TestGenFunctions(unittest.TestCase):

    def test_getProperties(self):
        self.assertEqual(getProperties({"a": 1, "b": 2}), ["a", "b"])
        self.assertEqual(getProperties({}), [])

    def test_is_json(self):
        self.assertTrue(is_json('{"name": "John", "age": 30}'))
        self.assertFalse(is_json('{name: John, age: 30}'))
        self.assertFalse(is_json(None))

    def test_it_floats(self):
        self.assertTrue(it_floats("3.14"))
        self.assertFalse(it_floats("abc"))
        self.assertFalse(it_floats(None))

    def test_is_int(self):
        self.assertTrue(is_int("123"))
        self.assertFalse(is_int("abc"))
        self.assertFalse(is_int(None))

    def test_returnIndexByName(self):
        paramList = [{"Name": "Ability1"}, {"Name": "Ability2"}]
        self.assertEqual(returnIndexByName("Ability1", paramList), 0)
        self.assertEqual(returnIndexByName("Ability3", paramList), -1)

    def test_returnIndexByHash(self):
        paramList = [{"Hash": 123}, {"Hash": 456}]
        self.assertEqual(returnIndexByHash(123, paramList), 0)
        self.assertEqual(returnIndexByHash(789, paramList), -1)

if __name__ == '__main__':
    unittest.main()