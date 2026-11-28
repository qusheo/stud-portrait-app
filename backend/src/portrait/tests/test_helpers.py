import unittest

from portrait.endpoints.helpers.common import attrIfObj, desc, isIn, join, zeroIfNull


class CommonUtilitiesTests(unittest.TestCase):
    def test_zero_if_null(self):
        self.assertEqual(zeroIfNull(None), 0.0)
        self.assertEqual(zeroIfNull(5), 5.0)
        self.assertEqual(zeroIfNull(3.14), 3.14)

    def test_attr_if_obj(self):
        class TestObj:
            attr = "value"

        obj = TestObj()
        self.assertEqual(attrIfObj(obj, "attr"), "value")
        self.assertIsNone(attrIfObj(None, "attr"))

    def test_join(self):
        self.assertEqual(join("a", "b", "c"), "a__b__c")

    def test_is_in(self):
        self.assertEqual(isIn("field", [1, 2, 3]), {"field__in": [1, 2, 3]})

    def test_desc(self):
        self.assertEqual(desc("field"), "-field")
